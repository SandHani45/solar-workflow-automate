/**
 * Single import point for mongoose in model files so the global serialize plugin is
 * registered before any schema is compiled into a model.
 */
import mongoose from 'mongoose';
import { serializePlugin } from './serialize';

mongoose.set('strictQuery', true);
mongoose.plugin(serializePlugin);

export { mongoose };
export const { Schema, Types, model, models } = mongoose;
export type ObjectId = mongoose.Types.ObjectId;
/** Loosely typed query filter; services build filters dynamically. */
export type Filter = Record<string, any>;
