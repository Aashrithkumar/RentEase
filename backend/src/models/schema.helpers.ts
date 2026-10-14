import mongoose, { Schema, type InferSchemaType } from 'mongoose';
export const ref = (name: string, required = true) => ({ type: Schema.Types.ObjectId, ref: name, required, index: true });
export const money = { type: Number, required: true, min: 0, validate: Number.isSafeInteger };
export const model = <T extends Schema>(name: string, schema: T) => mongoose.model<InferSchemaType<T>>(name, schema);
