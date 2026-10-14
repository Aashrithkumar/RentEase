import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { config, validateConfig } from '../config/env.js';
import { User, Property, RentalApplication, Lease, RentObligation, Payment, MaintenanceRequest, Expense, Notification } from '../models/index.js';
import { transaction } from '../config/database.js';
import { generateObligations } from '../services/rent.service.js';
validateConfig();
if (config.production)
    throw new Error('Demo seeding is disabled in production.');
await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 15000 });
await Promise.all(Object.values(mongoose.models).map(m => m.init()));
try {
    if (await User.exists({ email: 'owner@demo.rentease.local' })) {
        console.log('Demo data already exists. No records changed. See demo-credentials.txt if seeded on this machine.');
    }
    else {
        const passwords = { owner: randomBytes(14).toString('base64url'), tenant: randomBytes(14).toString('base64url'), admin: randomBytes(14).toString('base64url') };
        await transaction(async (session) => {
            const [owner, tenant] = await User.create([
                { name: 'Aarav Sharma (Demo)', email: 'owner@demo.rentease.local', password: await bcrypt.hash(passwords.owner, 12), role: 'owner', phone: '9876543210', demo: true },
                { name: 'Ananya Rao (Demo)', email: 'tenant@demo.rentease.local', password: await bcrypt.hash(passwords.tenant, 12), role: 'tenant', phone: '9876543211', demo: true },
                { name: 'Demo Administrator', email: 'admin@demo.rentease.local', password: await bcrypt.hash(passwords.admin, 12), role: 'admin', demo: true },
            ], { session, ordered: true });
            const images = ['photo-1600607687920-4e2a09cf159d', 'photo-1600585154340-be6161a56a0c', 'photo-1600047509807-ba8f99d2cdde', 'photo-1522708323590-d24dbb6b0267'];
            const cities = [{ city: 'Bengaluru', state: 'Karnataka', pin: '560066', areas: ['Whitefield', 'Indiranagar', 'Sarjapur Road', 'HSR Layout'] }, { city: 'Hyderabad', state: 'Telangana', pin: '500032', areas: ['Gachibowli', 'Kondapur', 'Madhapur', 'Banjara Hills'] }, { city: 'Pune', state: 'Maharashtra', pin: '411045', areas: ['Baner', 'Wakad', 'Hinjewadi', 'Kharadi'] }, { city: 'Chennai', state: 'Tamil Nadu', pin: '600096', areas: ['Perungudi', 'Adyar', 'Velachery', 'Anna Nagar'] }];
            const types = ['Apartment', 'Apartment', 'Villa', 'Studio'];
            const rents = [28000, 35000, 48000, 18000];
            const names = ['Sunlit 2 BHK at Palm Residences', 'A spacious home at The Grove', 'A garden villa at Green Meadows', 'Your cosy corner at Urban Nest'];
            const properties = await Property.create(cities.flatMap(c => c.areas.map((locality, i) => ({ owner: owner._id, title: names[i], description: `Demo property: a thoughtfully designed ${types[i].toLowerCase()} in ${locality}, ${c.city}. Enjoy bright interiors and convenient neighbourhood essentials. This is sample data for exploring RentEase, not a real rental offer.`, type: types[i], address: `${i + 12}, ${locality} Main Road`, locality, city: c.city, state: c.state, pincode: c.pin, bedrooms: [2, 3, 3, 1][i], bathrooms: [2, 2, 3, 1][i], area: [1250, 1680, 2100, 650][i], rentPaise: rents[i] * 100, depositPaise: rents[i] * 200, amenities: ['Parking', 'Security', 'Balcony', ...(i === 1 ? ['Gym', 'Lift', 'Power Backup'] : [])], images: [{ url: `https://images.unsplash.com/${images[i]}?auto=format&fit=crop&w=1000&q=85` }, { url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=85' }], demo: true }))), { session, ordered: true });
            const [occupied] = await Property.create([{ ...properties[0].toObject(), _id: new mongoose.Types.ObjectId(), title: 'Your home at Maple Heights (Demo)', status: 'Occupied' }], { session, ordered: true });
            const [approved] = await RentalApplication.create([{ property: occupied._id, owner: owner._id, tenant: tenant._id, message: 'Demo: I would love to make this apartment my home.', status: 'Approved' }, { property: properties[1]._id, owner: owner._id, tenant: tenant._id, message: 'Demo: Looking for a spacious place near work.', status: 'Pending' }], { session, ordered: true });
            const now = new Date();
            const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
            const end = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth() - 2, 0));
            const [lease] = await Lease.create([{ property: occupied._id, owner: owner._id, tenant: tenant._id, application: approved._id, startDate: start, endDate: end, rentPaise: 2800000, depositPaise: 5600000, status: 'Active' }], { session, ordered: true });
            await generateObligations(lease, session);
            const due = await RentObligation.find({ lease: lease._id, dueDate: { $lt: now } }).session(session).sort({ dueDate: 1 });
            for (const [i, o] of due.entries()) {
                o.amountPaidPaise = i === due.length - 1 ? 1400000 : o.amountDuePaise;
                await o.save({ session });
                await Payment.create([{ obligation: o._id, lease: lease._id, owner: owner._id, tenant: tenant._id, property: occupied._id, amountPaise: o.amountPaidPaise, paymentDate: new Date(o.dueDate.getTime() + 2 * 86400000), method: 'UPI', reference: `DEMO-${o.month}`, recordedBy: owner._id }], { session, ordered: true });
                await Expense.create([{ property: occupied._id, owner: owner._id, category: i === 0 ? 'Cleaning' : 'Maintenance', description: 'Demo: Routine property upkeep', amountPaise: (i + 1) * 125000, expenseDate: new Date(o.dueDate.getTime() + 3 * 86400000) }], { session, ordered: true });
            }
            await MaintenanceRequest.create([{ property: occupied._id, lease: lease._id, owner: owner._id, tenant: tenant._id, title: 'Demo: Kitchen tap needs attention', description: 'Demo request: a slow leak from the kitchen tap.', category: 'Plumbing', priority: 'Medium', status: 'Pending' }], { session, ordered: true });
            await Notification.create([{ user: owner._id, title: 'Welcome to your demo workspace', message: 'All demo properties and records are sample data. Explore the workflows, or create your own account.' }, { user: tenant._id, title: 'Your demo home is ready', message: 'Explore your lease, rent receipts and maintenance requests. These records are explicitly demo data.' }, { user: owner._id, title: 'New demo application', message: 'Ananya has applied for a demo property.' }], { session, ordered: true });
        });
        await writeFile('../demo-credentials.txt', `RentEase DEVELOPMENT DEMO ONLY\nNever deploy these accounts in production.\n\nOwner: owner@demo.rentease.local\nPassword: ${passwords.owner}\n\nTenant: tenant@demo.rentease.local\nPassword: ${passwords.tenant}\n\nAdmin: admin@demo.rentease.local\nPassword: ${passwords.admin}\n`, { mode: 0o600 });
        console.log('Created 17 labelled demo properties, three demo accounts and linked rental records. Random credentials saved to demo-credentials.txt; no passwords printed.');
    }
}
finally {
    await mongoose.disconnect();
}
