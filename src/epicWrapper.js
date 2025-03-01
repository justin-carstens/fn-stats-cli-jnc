/**
 * Epic Games API CommonJS Wrapper
 * Bridges CommonJS and ES Modules for the @squiddleton/epic package
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { EpicClient } = require('@squiddleton/epic');

export { EpicClient };