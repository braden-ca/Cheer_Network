"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = exports.passwordUpdateSchema = exports.passwordResetSchema = exports.eventsQuerySchema = exports.eventFiltersSchema = exports.paginationSchema = exports.createNewsPostSchema = exports.createSocialPostSchema = exports.createMessageSchema = exports.updateEventSchema = exports.createEventFrontendSchema = exports.createEventSchema = exports.athleteProfileSchema = exports.clinicianProfileSchema = exports.updateProfileSchema = exports.loginSchema = exports.clinicianRegisterSchema = exports.registerSchema = exports.validateRequest = void 0;
const joi_1 = __importDefault(require("joi"));
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation error',
                details: error.details.map((detail) => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }))
            });
        }
        req.body = value;
        next();
    };
};
exports.validateRequest = validateRequest;
exports.registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(8).required(),
    firstName: joi_1.default.string().min(2).max(50).required(),
    lastName: joi_1.default.string().min(2).max(50).required(),
    role: joi_1.default.string().valid('athlete', 'clinician').required()
});
exports.clinicianRegisterSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(8).required(),
    firstName: joi_1.default.string().min(2).max(50).required(),
    lastName: joi_1.default.string().min(2).max(50).required(),
    role: joi_1.default.string().valid('clinician').required(),
    yearsExperience: joi_1.default.number().integer().min(0).max(50).required(),
    specialties: joi_1.default.array().items(joi_1.default.string().min(1).max(100)).min(1).required(),
    city: joi_1.default.string().min(1).max(100).allow('', null).optional(),
    state: joi_1.default.string().min(2).max(50).allow('', null).optional(),
    currentSchool: joi_1.default.string().min(1).max(200).allow('', null).optional(),
    profileImageUrl: joi_1.default.string().allow('', null).optional(),
    bio: joi_1.default.string().max(500).allow('', null).optional()
});
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required()
});
exports.updateProfileSchema = joi_1.default.object({
    firstName: joi_1.default.string().min(2).max(50),
    lastName: joi_1.default.string().min(2).max(50),
    bio: joi_1.default.string().max(500).allow(''),
    profileImageUrl: joi_1.default.string().uri().allow('')
});
exports.clinicianProfileSchema = joi_1.default.object({
    specialties: joi_1.default.array().items(joi_1.default.string()),
    yearsExperience: joi_1.default.number().integer().min(0),
    certifications: joi_1.default.array().items(joi_1.default.string()),
    location: joi_1.default.string().max(100).allow(''),
    hourlyRate: joi_1.default.number().positive().allow(null)
});
exports.athleteProfileSchema = joi_1.default.object({
    age: joi_1.default.number().integer().min(5).max(100).allow(null),
    skillLevel: joi_1.default.string().valid('beginner', 'intermediate', 'advanced', 'elite'),
    teamAffiliation: joi_1.default.string().max(100).allow(''),
    goals: joi_1.default.string().max(500).allow(''),
    location: joi_1.default.string().max(100).allow('')
});
exports.createEventSchema = joi_1.default.object({
    title: joi_1.default.string().min(3).max(100).required(),
    description: joi_1.default.string().max(1000).allow(''),
    location: joi_1.default.string().min(3).max(200).required(),
    startDate: joi_1.default.date().greater('now').required(),
    endDate: joi_1.default.date().greater(joi_1.default.ref('startDate')).required(),
    maxAthletes: joi_1.default.number().integer().min(1).max(100).required(),
    price: joi_1.default.number().min(0).required(),
    isPrivate: joi_1.default.boolean().default(false),
    imageUrl: joi_1.default.string().uri().allow(''),
    requirements: joi_1.default.string().max(500).allow('')
});
exports.createEventFrontendSchema = joi_1.default.object({
    title: joi_1.default.string().min(3).max(100).required(),
    description: joi_1.default.string().max(1000).allow(''),
    location: joi_1.default.string().min(3).max(200).required(),
    date: joi_1.default.date().greater('now').required(),
    duration: joi_1.default.object({
        days: joi_1.default.number().integer().min(0).max(30).required(),
        hours: joi_1.default.number().integer().min(0).max(23).required(),
        minutes: joi_1.default.number().integer().min(0).max(59).required()
    }).required(),
    price: joi_1.default.number().min(0).required(),
    max_athletes: joi_1.default.number().integer().min(1).max(100).default(30),
    overnight_camp: joi_1.default.boolean().default(false),
    required_items: joi_1.default.array().items(joi_1.default.string().min(1).max(100)).default([]),
    recommended_items: joi_1.default.array().items(joi_1.default.string().min(1).max(100)).default([])
});
exports.updateEventSchema = joi_1.default.object({
    title: joi_1.default.string().min(3).max(100),
    description: joi_1.default.string().max(1000).allow(''),
    location: joi_1.default.string().min(3).max(200),
    startDate: joi_1.default.date().greater('now'),
    endDate: joi_1.default.date().greater(joi_1.default.ref('startDate')),
    maxAthletes: joi_1.default.number().integer().min(1).max(100),
    price: joi_1.default.number().min(0),
    isPrivate: joi_1.default.boolean(),
    imageUrl: joi_1.default.string().uri().allow(''),
    requirements: joi_1.default.string().max(500).allow('')
});
exports.createMessageSchema = joi_1.default.object({
    receiverId: joi_1.default.string().uuid().required(),
    content: joi_1.default.string().min(1).max(1000).required()
});
exports.createSocialPostSchema = joi_1.default.object({
    content: joi_1.default.string().min(1).max(500).required(),
    imageUrls: joi_1.default.array().items(joi_1.default.string().uri()).max(4).default([])
});
exports.createNewsPostSchema = joi_1.default.object({
    title: joi_1.default.string().min(3).max(200).required(),
    content: joi_1.default.string().min(10).required(),
    featuredImageUrl: joi_1.default.string().uri().allow(''),
    published: joi_1.default.boolean().default(false)
});
exports.paginationSchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(10)
});
exports.eventFiltersSchema = joi_1.default.object({
    location: joi_1.default.string().max(100),
    startDate: joi_1.default.date(),
    endDate: joi_1.default.date(),
    maxPrice: joi_1.default.number().min(0),
    skillLevel: joi_1.default.string().valid('beginner', 'intermediate', 'advanced', 'elite'),
    specialties: joi_1.default.array().items(joi_1.default.string()),
    clinicianId: joi_1.default.string().uuid()
});
exports.eventsQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(10),
    location: joi_1.default.string().max(100),
    startDate: joi_1.default.date(),
    endDate: joi_1.default.date(),
    maxPrice: joi_1.default.number().min(0),
    skillLevel: joi_1.default.string().valid('beginner', 'intermediate', 'advanced', 'elite'),
    specialties: joi_1.default.array().items(joi_1.default.string()),
    clinicianId: joi_1.default.string().uuid()
});
exports.passwordResetSchema = joi_1.default.object({
    email: joi_1.default.string().email().required()
});
exports.passwordUpdateSchema = joi_1.default.object({
    currentPassword: joi_1.default.string().required(),
    newPassword: joi_1.default.string().min(8).required()
});
const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query);
        if (error) {
            return res.status(400).json({
                error: 'Query validation error',
                details: error.details.map((detail) => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }))
            });
        }
        req.query = value;
        next();
    };
};
exports.validateQuery = validateQuery;
//# sourceMappingURL=validation.js.map