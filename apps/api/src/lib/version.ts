import pkg from '../../package.json' with { type: 'json' };

export const APP_VERSION: string = process.env.APP_VERSION || pkg.version;
