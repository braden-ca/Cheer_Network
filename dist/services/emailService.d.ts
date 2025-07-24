export declare class EmailService {
    private static instance;
    static getInstance(): EmailService;
    private sendEmail;
    sendVerificationEmail(email: string, verificationLink: string): Promise<boolean>;
    sendPasswordResetEmail(email: string, resetLink: string): Promise<boolean>;
    sendFollowRequestNotification(clinicianEmail: string, athleteName: string, dashboardLink: string): Promise<boolean>;
    sendEventRegistrationConfirmation(athleteEmail: string, eventTitle: string, eventDetails: string, eventLink: string): Promise<boolean>;
    sendNewMessageNotification(recipientEmail: string, senderName: string, messagePreview: string, messagesLink: string): Promise<boolean>;
}
//# sourceMappingURL=emailService.d.ts.map