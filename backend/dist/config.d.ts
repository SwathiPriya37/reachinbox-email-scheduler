export declare const config: {
    readonly port: number;
    readonly database: {
        readonly url: string;
    };
    readonly redis: {
        readonly url: string;
    };
    readonly worker: {
        readonly concurrency: number;
        readonly rateLimiterMax: number;
        readonly minDelayBetweenSendsMs: number;
    };
    readonly rateLimit: {
        readonly maxEmailsPerHourPerSender: number;
        readonly maxEmailsPerHourGlobal: number;
    };
    readonly nodeEnv: string;
};
//# sourceMappingURL=config.d.ts.map