export function publicUser(user: {
    _id: unknown;
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    role?: unknown;
    status?: unknown;
    demo?: unknown;
}) { return { _id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status, demo: user.demo }; }
