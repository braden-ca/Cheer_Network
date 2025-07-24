import Stripe from 'stripe';
export declare class PaymentService {
    private static instance;
    static getInstance(): PaymentService;
    createEventPaymentIntent(registrationId: string, amount: number, currency?: string): Promise<{
        clientSecret: string;
        paymentIntentId: string;
    }>;
    confirmPayment(paymentIntentId: string): Promise<void>;
    createRefund(registrationId: string, reason?: string): Promise<Stripe.Refund>;
    handleWebhook(payload: string | Buffer, signature: string): Promise<void>;
    private handlePaymentSucceeded;
    private handlePaymentFailed;
    private handleRefundCreated;
    getPaymentStatus(registrationId: string): Promise<{
        status: string;
        paymentIntentId?: string;
        amountPaid?: number;
    }>;
    getOrCreateCustomer(userId: string): Promise<Stripe.Customer>;
    getPaymentHistory(userId: string): Promise<any[]>;
}
//# sourceMappingURL=paymentService.d.ts.map