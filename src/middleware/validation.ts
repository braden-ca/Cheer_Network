import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map((detail: any) => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    req.body = value;
    next();
  };
};

// User registration schema
export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  role: Joi.string().valid('athlete', 'clinician').required()
});

// Enhanced clinician registration schema
export const clinicianRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  role: Joi.string().valid('clinician').required(),
  yearsExperience: Joi.number().integer().min(0).max(50).required(),
  specialties: Joi.array().items(Joi.string().min(1).max(100)).min(1).required(),
  city: Joi.string().min(1).max(100).allow('', null).optional(), // Allow empty string and null
  state: Joi.string().min(2).max(50).allow('', null).optional(), // Allow state names and codes
  currentSchool: Joi.string().min(1).max(200).allow('', null).optional(), // Allow null
  profileImageUrl: Joi.string().allow('', null).optional(), // Allow null and empty
  bio: Joi.string().max(500).allow('', null).optional() // Allow null and empty
});

// User login schema
export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// User profile update schema
export const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50),
  lastName: Joi.string().min(2).max(50),
  bio: Joi.string().max(500).allow(''),
  profileImageUrl: Joi.string().uri().allow('')
});

// Clinician profile schema
export const clinicianProfileSchema = Joi.object({
  specialties: Joi.array().items(Joi.string()),
  yearsExperience: Joi.number().integer().min(0),
  certifications: Joi.array().items(Joi.string()),
  location: Joi.string().max(100).allow(''),
  hourlyRate: Joi.number().positive().allow(null)
});

// Athlete profile schema
export const athleteProfileSchema = Joi.object({
  age: Joi.number().integer().min(5).max(100).allow(null),
  skillLevel: Joi.string().valid('beginner', 'intermediate', 'advanced', 'elite'),
  teamAffiliation: Joi.string().max(100).allow(''),
  goals: Joi.string().max(500).allow(''),
  location: Joi.string().max(100).allow('')
});

// Event creation schema
export const createEventSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(1000).allow(''),
  location: Joi.string().min(3).max(200).required(),
  startDate: Joi.date().greater('now').required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  maxAthletes: Joi.number().integer().min(1).max(100).required(),
  price: Joi.number().min(0).required(),
  isPrivate: Joi.boolean().default(false),
  imageUrl: Joi.string().uri().allow(''),
  requirements: Joi.string().max(500).allow('')
});

// Frontend event creation schema (matches what the frontend sends)
export const createEventFrontendSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(1000).allow(''),
  location: Joi.string().min(3).max(200).required(),
  date: Joi.date().greater('now').required(),
  duration: Joi.object({
    days: Joi.number().integer().min(0).max(30).required(),
    hours: Joi.number().integer().min(0).max(23).required(),
    minutes: Joi.number().integer().min(0).max(59).required()
  }).required(),
  price: Joi.number().min(0).required(),
  max_athletes: Joi.number().integer().min(1).max(100).default(30),
  overnight_camp: Joi.boolean().default(false),
  required_items: Joi.array().items(Joi.string().min(1).max(100)).default([]),
  recommended_items: Joi.array().items(Joi.string().min(1).max(100)).default([])
});

// Event update schema
export const updateEventSchema = Joi.object({
  title: Joi.string().min(3).max(100),
  description: Joi.string().max(1000).allow(''),
  location: Joi.string().min(3).max(200),
  startDate: Joi.date().greater('now'),
  endDate: Joi.date().greater(Joi.ref('startDate')),
  maxAthletes: Joi.number().integer().min(1).max(100),
  price: Joi.number().min(0),
  isPrivate: Joi.boolean(),
  imageUrl: Joi.string().uri().allow(''),
  requirements: Joi.string().max(500).allow('')
});

// Message creation schema
export const createMessageSchema = Joi.object({
  receiverId: Joi.string().uuid().required(),
  content: Joi.string().min(1).max(1000).required()
});

// Social post creation schema
export const createSocialPostSchema = Joi.object({
  content: Joi.string().min(1).max(500).required(),
  imageUrls: Joi.array().items(Joi.string().uri()).max(4).default([])
});

// News post creation schema
export const createNewsPostSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  content: Joi.string().min(10).required(),
  featuredImageUrl: Joi.string().uri().allow(''),
  published: Joi.boolean().default(false)
});

// Query parameter validation schemas
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

export const eventFiltersSchema = Joi.object({
  location: Joi.string().max(100),
  startDate: Joi.date(),
  endDate: Joi.date(),
  maxPrice: Joi.number().min(0),
  skillLevel: Joi.string().valid('beginner', 'intermediate', 'advanced', 'elite'),
  specialties: Joi.array().items(Joi.string()),
  clinicianId: Joi.string().uuid()
});

// Combined schema for events API that includes both pagination and filters
export const eventsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  location: Joi.string().max(100),
  startDate: Joi.date(),
  endDate: Joi.date(),
  maxPrice: Joi.number().min(0),
  skillLevel: Joi.string().valid('beginner', 'intermediate', 'advanced', 'elite'),
  specialties: Joi.array().items(Joi.string()),
  clinicianId: Joi.string().uuid()
});

// Password reset schema
export const passwordResetSchema = Joi.object({
  email: Joi.string().email().required()
});

// Password update schema
export const passwordUpdateSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query);
    
    if (error) {
      return res.status(400).json({
        error: 'Query validation error',
        details: error.details.map((detail: any) => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    req.query = value;
    next();
  };
}; 