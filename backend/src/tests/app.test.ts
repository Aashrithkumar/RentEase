import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { resolve } from 'node:path';
import { app } from '../app.js';
import { Property, RentalApplication, Lease, RentObligation, Payment, Notification, User, RefreshToken, PasswordResetToken } from '../models/index.js';
import { hash, accessToken } from '../utils/tokens.js';
import bcrypt from 'bcryptjs';
import { AuditLog } from '../models/index.js';
let db: MongoMemoryReplSet;
let owner: string, tenant: string, otherOwner: string, otherTenant: string, property: string, application: string, lease: string, obligation: string, maintenance: string, expense: string, tenantId: string;
const user = (name: string, role: string) => ({ name, email: `${name.toLowerCase()}@test.example`, password: 'Strong-Test-Password-2026', role, phone: '' });
const listing = { title: 'Bright 2 BHK home in Whitefield', description: 'A spacious sunlit apartment with a balcony, parking and comfortable living areas.', type: 'Apartment', address: '12 Palm Avenue', city: 'Bengaluru', state: 'Karnataka', pincode: '560066', locality: 'Whitefield', bedrooms: 2, bathrooms: 2, area: 1200, rentPaise: 2800000, depositPaise: 5600000, amenities: ['Parking', 'Balcony'] };
beforeAll(async () => { db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.14', downloadDir: resolve('artifacts/mongodb-binaries') } }); await mongoose.connect(db.getUri()); await Promise.all(Object.values(mongoose.models).map(m => m.init())); });
afterAll(async () => { await mongoose.disconnect(); if (db)
    await db.stop(); });
describe.sequential('RentEase security and rental workflows', () => {
    it('blocks public admin registration', async () => { const r = await request(app).post('/api/v1/auth/register').send(user('Admin', 'admin')); expect(r.status).toBe(400); });
    it('registers users and keeps password hashes private', async () => { for (const [name, role] of [['Owner', 'owner'], ['Tenant', 'tenant'], ['OtherOwner', 'owner'], ['OtherTenant', 'tenant']]) {
        const r = await request(app).post('/api/v1/auth/register').send(user(name, role));
        expect(r.status).toBe(201);
        expect(r.body.data.user.password).toBeUndefined();
        expect(r.headers['set-cookie'][0]).toContain('HttpOnly');
        if (name === 'Owner')
            owner = r.body.data.accessToken;
        if (name === 'Tenant') {
            tenant = r.body.data.accessToken;
            tenantId = r.body.data.user._id;
        }
        if (name === 'OtherOwner')
            otherOwner = r.body.data.accessToken;
        if (name === 'OtherTenant')
            otherTenant = r.body.data.accessToken;
    } const stored = await User.findOne({ email: 'owner@test.example' }).select('+password'); expect(stored!.password).not.toBe('Strong-Test-Password-2026'); });
    it('rejects invalid login and untrusted cookie origins', async () => { const r = await request(app).post('/api/v1/auth/login').send({ email: 'owner@test.example', password: 'invalid-password' }); expect(r.status).toBe(401); const blocked = await request(app).post('/api/v1/auth/refresh').set('Origin', 'https://evil.example').send({}); expect(blocked.status).toBe(403); });
    it('rotates refresh cookies and revokes a reused family', async () => { const agent = request.agent(app); const login = await agent.post('/api/v1/auth/login').send({ email: 'owner@test.example', password: 'Strong-Test-Password-2026' }); const old = login.headers['set-cookie'][0].split(';')[0]; const refreshed = await agent.post('/api/v1/auth/refresh').send({}); expect(refreshed.status).toBe(200); const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', old).send({}); expect(replay.status).toBe(401); expect((await agent.post('/api/v1/auth/refresh').send({})).status).toBe(401); });
    it('allows owner listing creation and blocks tenants', async () => { expect((await request(app).post('/api/v1/properties').auth(tenant, { type: 'bearer' }).send(listing)).status).toBe(403); const r = await request(app).post('/api/v1/properties').auth(owner, { type: 'bearer' }).send(listing); expect(r.status).toBe(201); property = r.body.data._id; });
    it('searches and validates public queries without exposing owners', async () => { const r = await request(app).get('/api/v1/properties?city=Bengaluru&minRent=20000&maxRent=30000&bedrooms=2'); expect(r.body.data.total).toBe(1); expect(r.body.data.items[0].owner).toBeUndefined(); expect((await request(app).get('/api/v1/properties?limit=900')).status).toBe(400); expect((await request(app).get('/api/v1/properties/not-an-id')).status).toBe(400); });
    it('enforces property ownership', async () => { expect((await request(app).patch(`/api/v1/properties/${property}`).auth(otherOwner, { type: 'bearer' }).send({ title: 'Unauthorized replacement title' })).status).toBe(404); });
    it('creates a persisted application and prevents duplicates', async () => { const r = await request(app).post('/api/v1/applications').auth(tenant, { type: 'bearer' }).send({ property, message: 'I would love to rent this home from this month.' }); expect(r.status).toBe(201); application = r.body.data._id; expect((await request(app).post('/api/v1/applications').auth(tenant, { type: 'bearer' }).send({ property, message: 'Another duplicate application.' })).status).toBe(409); expect(await Notification.countDocuments()).toBeGreaterThan(0); });
    it('protects application privacy and owner review', async () => { expect((await request(app).get(`/api/v1/applications/${application}`).auth(otherTenant, { type: 'bearer' })).status).toBe(404); expect((await request(app).patch(`/api/v1/applications/${application}/status`).auth(otherOwner, { type: 'bearer' }).send({ status: 'Approved' })).status).toBe(409); const r = await request(app).patch(`/api/v1/applications/${application}/status`).auth(owner, { type: 'bearer' }).send({ status: 'Approved' }); expect(r.status).toBe(200); expect((await Property.findById(property))!.status).toBe('Available'); });
    it('creates an active lease transactionally with unique monthly obligations', async () => { const now = new Date(); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10); const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 0)).toISOString().slice(0, 10); const r = await request(app).post('/api/v1/leases').auth(owner, { type: 'bearer' }).send({ application, startDate: start, endDate: end, rentPaise: 2800000, depositPaise: 5600000, status: 'Active' }); expect(r.status).toBe(201); lease = r.body.data._id; expect((await Property.findById(property))!.status).toBe('Occupied'); expect(await RentObligation.countDocuments({ lease })).toBe(3); obligation = String((await RentObligation.findOne({ lease }).sort({ dueDate: 1 }))!._id); });
    it('prevents conflicting active leases and protects lease access', async () => { expect((await request(app).get(`/api/v1/leases/${lease}`).auth(otherTenant, { type: 'bearer' })).status).toBe(404); expect((await request(app).delete(`/api/v1/properties/${property}`).auth(owner, { type: 'bearer' })).status).toBe(409); expect((await request(app).patch(`/api/v1/properties/${property}`).auth(owner, { type: 'bearer' }).send({ status: 'Available' })).status).toBe(409); const existing = (await Lease.findById(lease))!; await expect(Lease.create({ property, owner: existing.owner, tenant: existing.tenant, application: new mongoose.Types.ObjectId(), startDate: existing.startDate, endDate: existing.endDate, rentPaise: 2800000, depositPaise: 5600000, status: 'Active' })).rejects.toMatchObject({ code: 11000 }); });
    it('records partial receipts, rejects overpayment and keeps financial history', async () => { const data = { obligation, amountPaise: 1000000, paymentDate: new Date().toISOString().slice(0, 10), method: 'UPI', reference: 'TEST-RECEIPT-1' }; const r = await request(app).post('/api/v1/payments').auth(owner, { type: 'bearer' }).send(data); expect(r.status).toBe(201); expect((await request(app).post('/api/v1/payments').auth(owner, { type: 'bearer' }).send({ ...data, amountPaise: 2000000 })).status).toBe(409); expect((await RentObligation.findById(obligation))!.amountPaidPaise).toBe(1000000); expect(await Payment.countDocuments()).toBe(1); expect((await request(app).post('/api/v1/payments').auth(tenant, { type: 'bearer' }).send(data)).status).toBe(403); });
    it('requires an active tenant lease for maintenance and protects updates', async () => { const input = { lease, title: 'Kitchen tap is leaking', description: 'A slow continuous leak from the kitchen tap needs repair.', category: 'Plumbing', priority: 'Medium' }; expect((await request(app).post('/api/v1/maintenance').auth(otherTenant, { type: 'bearer' }).send(input)).status).toBe(403); const r = await request(app).post('/api/v1/maintenance').auth(tenant, { type: 'bearer' }).send(input); expect(r.status).toBe(201); maintenance = r.body.data._id; expect((await request(app).patch(`/api/v1/maintenance/${maintenance}`).auth(otherOwner, { type: 'bearer' }).send({ status: 'Completed' })).status).toBe(404); expect((await request(app).patch(`/api/v1/maintenance/${maintenance}`).auth(owner, { type: 'bearer' }).send({ status: 'Completed', resolutionNotes: 'Tap washer replaced.' })).status).toBe(200); });
    it('records owner expenses and derives analytics from stored data', async () => { const data = { property, category: 'Repairs', description: 'Tap washer and labour charge', amountPaise: 85000, expenseDate: new Date().toISOString().slice(0, 10) }; expect((await request(app).post('/api/v1/expenses').auth(otherOwner, { type: 'bearer' }).send(data)).status).toBe(403); const r = await request(app).post('/api/v1/expenses').auth(owner, { type: 'bearer' }).send(data); expect(r.status).toBe(201); expense = r.body.data._id; const stats = await request(app).get('/api/v1/analytics/overview').auth(owner, { type: 'bearer' }); expect(stats.body.data.occupied).toBe(1); expect(stats.body.data.rentCollectedPaise).toBe(1000000); expect(stats.body.data.expensesPaise).toBe(85000); });
    it('supports notifications without cross-user access', async () => { const notice = (await Notification.findOne({ user: tenantId }))!; expect((await request(app).patch(`/api/v1/notifications/${notice._id}/read`).auth(otherTenant, { type: 'bearer' }).send({})).status).toBe(404); expect((await request(app).patch('/api/v1/notifications/read-all').auth(tenant, { type: 'bearer' }).send({})).status).toBe(200); expect(await Notification.countDocuments({ user: tenantId, read: false })).toBe(0); });
    it('preserves lease/payment history on termination and archives expenses', async () => { expect((await request(app).patch(`/api/v1/leases/${lease}`).auth(owner, { type: 'bearer' }).send({ status: 'Terminated' })).status).toBe(200); expect((await Property.findById(property))!.status).toBe('Available'); expect(await Lease.countDocuments({ _id: lease })).toBe(1); expect(await Payment.countDocuments()).toBe(1); expect((await request(app).delete(`/api/v1/expenses/${expense}`).auth(owner, { type: 'bearer' })).status).toBe(200); expect((await request(app).get('/api/v1/expenses').auth(owner, { type: 'bearer' })).body.data.total).toBe(0); });
    it('rejects fractional paise and non-owner financial operations', async () => { expect((await request(app).post('/api/v1/payments').auth(owner, { type: 'bearer' }).send({ obligation, amountPaise: 12.5, paymentDate: '2026-10-14', method: 'Cash' })).status).toBe(400); expect((await request(app).get('/api/v1/admin/users').auth(tenant, { type: 'bearer' })).status).toBe(403); });
    it('preserves cancelled future rent obligations after termination', async () => { expect(await RentObligation.countDocuments({ lease })).toBe(3); expect(await RentObligation.countDocuments({ lease, cancelled: true })).toBe(2); });
    it('consumes reset tokens once and revokes old access tokens', async () => { const raw = 'a'.repeat(64); await PasswordResetToken.create({ user: tenantId, hash: hash(raw), expiresAt: new Date(Date.now() + 600000) }); const input = { token: raw, password: 'A-New-Strong-Password-2026' }; expect((await request(app).post('/api/v1/auth/reset-password').send(input)).status).toBe(200); expect((await request(app).post('/api/v1/auth/reset-password').send(input)).status).toBe(400); expect((await request(app).get('/api/v1/auth/me').auth(tenant, { type: 'bearer' })).status).toBe(401); expect((await request(app).post('/api/v1/auth/login').send({ email: 'tenant@test.example', password: input.password })).status).toBe(200); });
    it('rejects impossible calendar dates', async () => { expect((await request(app).post('/api/v1/payments').auth(owner, { type: 'bearer' }).send({ obligation, amountPaise: 100, paymentDate: '2026-02-30', method: 'Cash' })).status).toBe(400); });
    let adminToken: string, adminId: string, moderatedProperty: string;
    it('restricts every administration endpoint to administrators', async () => {
        const admin = await User.create({ name: 'Test Administrator', email: 'admin@test.example', password: await bcrypt.hash('Secure-Admin-Test-Password', 4), role: 'admin' });
        adminToken = accessToken(admin);
        adminId = String(admin._id);
        for (const endpoint of ['overview', 'users', 'properties', 'activity', 'audit']) {
            expect((await request(app).get(`/api/v1/admin/${endpoint}`)).status).toBe(401);
            expect((await request(app).get(`/api/v1/admin/${endpoint}`).auth(owner, { type: 'bearer' })).status).toBe(403);
            expect((await request(app).get(`/api/v1/admin/${endpoint}`).auth(adminToken, { type: 'bearer' })).status).toBe(200);
        }
    });
    it('searches and paginates admin users without exposing authentication data', async () => {
        const r = await request(app).get('/api/v1/admin/users?q=OtherOwner&role=owner&status=active&limit=1').auth(adminToken, { type: 'bearer' });
        expect(r.body.data.total).toBe(1);
        expect(r.body.data.items).toHaveLength(1);
        expect(r.body.data.items[0].password).toBeUndefined();
        expect(r.body.data.items[0].tokenVersion).toBeUndefined();
        const detail = await request(app).get(`/api/v1/admin/users/${tenantId}`).auth(adminToken, { type: 'bearer' });
        expect(detail.status).toBe(200);
        expect(detail.body.data.summary.applications).toBe(1);
        expect((await request(app).get('/api/v1/admin/users?limit=999').auth(adminToken, { type: 'bearer' })).status).toBe(400);
    });
    it('suspends and reactivates users transactionally with an immutable audit trail', async () => {
        const target = (await User.findOne({ email: 'otherowner@test.example' }))!;
        const agent = request.agent(app);
        await agent.post('/api/v1/auth/login').send({ email: target.email, password: 'Strong-Test-Password-2026' });
        const suspended = await request(app).patch(`/api/v1/admin/users/${target._id}/status`).auth(adminToken, { type: 'bearer' }).send({ status: 'suspended', reason: 'Test moderation review' });
        expect(suspended.status).toBe(200);
        expect(suspended.body.data.password).toBeUndefined();
        expect((await request(app).get('/api/v1/auth/me').auth(otherOwner, { type: 'bearer' })).status).toBe(401);
        expect((await agent.post('/api/v1/auth/refresh').send({})).status).toBe(401);
        expect((await request(app).patch(`/api/v1/admin/users/${target._id}/status`).auth(adminToken, { type: 'bearer' }).send({ status: 'active', reason: 'Review completed' })).status).toBe(200);
        expect((await request(app).get('/api/v1/auth/me').auth(otherOwner, { type: 'bearer' })).status).toBe(401);
        expect(await AuditLog.countDocuments({ target: target._id })).toBe(2);
        expect((await request(app).patch(`/api/v1/admin/users/${adminId}/status`).auth(adminToken, { type: 'bearer' }).send({ status: 'suspended' })).status).toBe(403);
    });
    it('hides listings from public search and applications while retaining owner access', async () => {
        const created = await request(app).post('/api/v1/properties').auth(owner, { type: 'bearer' }).send({ ...listing, title: 'Admin moderation test home' });
        moderatedProperty = created.body.data._id;
        const hidden = await request(app).patch(`/api/v1/admin/properties/${moderatedProperty}/moderation`).auth(adminToken, { type: 'bearer' }).send({ action: 'hide', reason: 'Listing information needs review' });
        expect(hidden.status).toBe(200);
        expect(hidden.body.data.status).toBe('Available');
        expect((await request(app).get(`/api/v1/properties/${moderatedProperty}`)).status).toBe(404);
        expect((await request(app).get(`/api/v1/properties?ids=${moderatedProperty}`)).body.data.total).toBe(0);
        expect((await request(app).get(`/api/v1/properties/mine/${moderatedProperty}`).auth(owner, { type: 'bearer' })).status).toBe(200);
        const freshTenant = accessToken((await User.findById(tenantId))!);
        expect((await request(app).post('/api/v1/applications').auth(freshTenant, { type: 'bearer' }).send({ property: moderatedProperty, message: 'I would like to rent this property.' })).status).toBe(409);
        await request(app).patch(`/api/v1/properties/${moderatedProperty}`).auth(owner, { type: 'bearer' }).send({ title: 'Owner updated listing title' });
        expect((await Property.findById(moderatedProperty))!.moderationStatus).toBe('hidden');
    });
    it('restores visibility and protects active tenancies from archive', async () => {
        expect((await request(app).patch(`/api/v1/admin/properties/${moderatedProperty}/moderation`).auth(adminToken, { type: 'bearer' }).send({ action: 'publish', reason: 'Details verified' })).status).toBe(200);
        const publicRecord = await request(app).get(`/api/v1/properties/${moderatedProperty}`);
        expect(publicRecord.status).toBe(200);
        expect(publicRecord.body.data.moderationReason).toBeUndefined();
        expect(publicRecord.body.data.moderatedBy).toBeUndefined();
        const applicationRecord = await RentalApplication.create({ property: moderatedProperty, owner: (await Property.findById(moderatedProperty))!.owner, tenant: tenantId, status: 'Approved' });
        const activeLease = await Lease.create({ property: moderatedProperty, owner: applicationRecord.owner, tenant: tenantId, application: applicationRecord._id, startDate: new Date(), endDate: new Date(Date.now() + 86400000 * 30), rentPaise: 2800000, depositPaise: 0, status: 'Active' });
        await Property.updateOne({ _id: moderatedProperty }, { status: 'Occupied' });
        expect((await request(app).patch(`/api/v1/admin/properties/${moderatedProperty}/moderation`).auth(adminToken, { type: 'bearer' }).send({ action: 'archive', reason: 'Archive request' })).status).toBe(409);
        expect((await request(app).patch(`/api/v1/admin/properties/${moderatedProperty}/moderation`).auth(adminToken, { type: 'bearer' }).send({ action: 'hide', reason: 'Hide public listing only' })).status).toBe(200);
        expect((await Property.findById(moderatedProperty))!.status).toBe('Occupied');
        expect((await Lease.findById(activeLease._id))!.status).toBe('Active');
        expect((await request(app).get('/api/v1/admin/properties?moderation=hidden').auth(adminToken, { type: 'bearer' })).body.data.total).toBe(1);
    });
    it('archives available listings without deleting records and records administrative actions', async () => {
        expect((await request(app).patch(`/api/v1/admin/properties/${property}/moderation`).auth(adminToken, { type: 'bearer' }).send({ action: 'archive', reason: 'Archive test listing' })).status).toBe(200);
        expect((await Property.findById(property))!.status).toBe('Archived');
        expect(await Payment.countDocuments()).toBe(1);
        const audit = await request(app).get('/api/v1/admin/audit?limit=2').auth(adminToken, { type: 'bearer' });
        expect(audit.status).toBe(200);
        expect(audit.body.data.total).toBeGreaterThanOrEqual(6);
        expect(audit.body.data.items[0].actor.name).toBe('Test Administrator');
        expect((await request(app).delete(`/api/v1/admin/audit/${audit.body.data.items[0]._id}`).auth(adminToken, { type: 'bearer' })).status).toBe(404);
        const summary = await request(app).get('/api/v1/admin/overview').auth(adminToken, { type: 'bearer' });
        expect(summary.body.data.hiddenProperties).toBe(1);
        expect(summary.body.data.totalUsers).toBe(5);
        expect(summary.body.data.activeLeases).toBe(1);
    });
});
