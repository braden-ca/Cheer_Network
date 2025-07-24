"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get('/specialties', async (req, res) => {
    try {
        const { data: specialties, error } = await database_1.supabase
            .from('specialties_lookup')
            .select('specialty_id, name')
            .order('name', { ascending: true });
        if (error) {
            if (error.code === '42P01') {
                console.warn('specialties_lookup table does not exist, returning default specialties');
                const defaultSpecialties = [
                    { specialty_id: '1', name: 'Tumbling' },
                    { specialty_id: '2', name: 'Stunting' },
                    { specialty_id: '3', name: 'Choreography' },
                    { specialty_id: '4', name: 'Flexibility Training' },
                    { specialty_id: '5', name: 'Strength & Conditioning' },
                    { specialty_id: '6', name: 'Competition Prep' },
                    { specialty_id: '7', name: 'Team Building' },
                    { specialty_id: '8', name: 'Performance Coaching' }
                ];
                return res.json({ specialties: defaultSpecialties });
            }
            return res.status(400).json({ error: error.message });
        }
        res.json({ specialties });
    }
    catch (error) {
        console.error('Get specialties error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/specialties', auth_1.authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Specialty name is required' });
        }
        const trimmedName = name.trim();
        const { data: existing } = await database_1.supabase
            .from('specialties_lookup')
            .select('specialty_id')
            .ilike('name', trimmedName)
            .single();
        if (existing) {
            return res.status(409).json({ error: 'Specialty already exists' });
        }
        const { data: newSpecialty, error } = await database_1.supabase
            .from('specialties_lookup')
            .insert({ name: trimmedName })
            .select('specialty_id, name')
            .single();
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json({ specialty: newSpecialty });
    }
    catch (error) {
        console.error('Add specialty error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/schools', async (req, res) => {
    try {
        const { search, state } = req.query;
        let query = database_1.supabase
            .from('schools_lookup')
            .select('school_id, name, city, state');
        if (search && typeof search === 'string') {
            query = query.ilike('name', `%${search}%`);
        }
        if (state && typeof state === 'string') {
            query = query.eq('state', state);
        }
        const { data: schools, error } = await query
            .order('name', { ascending: true })
            .limit(100);
        if (error) {
            if (error.code === '42P01') {
                console.warn('schools_lookup table does not exist, returning default schools');
                const defaultSchools = [
                    { school_id: '1', name: 'University of Alabama', city: 'Tuscaloosa', state: 'AL' },
                    { school_id: '2', name: 'University of Kentucky', city: 'Lexington', state: 'KY' },
                    { school_id: '3', name: 'University of Oklahoma', city: 'Norman', state: 'OK' },
                    { school_id: '4', name: 'University of Tennessee', city: 'Knoxville', state: 'TN' },
                    { school_id: '5', name: 'University of Florida', city: 'Gainesville', state: 'FL' },
                    { school_id: '6', name: 'Louisiana State University', city: 'Baton Rouge', state: 'LA' },
                    { school_id: '7', name: 'University of Georgia', city: 'Athens', state: 'GA' },
                    { school_id: '8', name: 'Auburn University', city: 'Auburn', state: 'AL' },
                    { school_id: '9', name: 'University of Arkansas', city: 'Fayetteville', state: 'AR' },
                    { school_id: '10', name: 'University of Mississippi', city: 'Oxford', state: 'MS' }
                ];
                let filteredSchools = defaultSchools;
                if (search && typeof search === 'string') {
                    filteredSchools = defaultSchools.filter(school => school.name.toLowerCase().includes(search.toLowerCase()));
                }
                if (state && typeof state === 'string') {
                    filteredSchools = filteredSchools.filter(school => school.state === state);
                }
                return res.json({ schools: filteredSchools });
            }
            return res.status(400).json({ error: error.message });
        }
        res.json({ schools });
    }
    catch (error) {
        console.error('Get schools error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/schools', auth_1.authenticateToken, async (req, res) => {
    try {
        const { name, city, state } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'School name is required' });
        }
        const trimmedName = name.trim();
        const trimmedCity = city?.trim() || null;
        const trimmedState = state?.trim() || null;
        const { data: existing } = await database_1.supabase
            .from('schools_lookup')
            .select('school_id')
            .ilike('name', trimmedName)
            .single();
        if (existing) {
            return res.status(409).json({ error: 'School already exists' });
        }
        const { data: newSchool, error } = await database_1.supabase
            .from('schools_lookup')
            .insert({
            name: trimmedName,
            city: trimmedCity,
            state: trimmedState
        })
            .select('school_id, name, city, state')
            .single();
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json({ school: newSchool });
    }
    catch (error) {
        console.error('Add school error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/states', async (req, res) => {
    try {
        const states = [
            { code: 'AL', name: 'Alabama' },
            { code: 'AK', name: 'Alaska' },
            { code: 'AZ', name: 'Arizona' },
            { code: 'AR', name: 'Arkansas' },
            { code: 'CA', name: 'California' },
            { code: 'CO', name: 'Colorado' },
            { code: 'CT', name: 'Connecticut' },
            { code: 'DE', name: 'Delaware' },
            { code: 'FL', name: 'Florida' },
            { code: 'GA', name: 'Georgia' },
            { code: 'HI', name: 'Hawaii' },
            { code: 'ID', name: 'Idaho' },
            { code: 'IL', name: 'Illinois' },
            { code: 'IN', name: 'Indiana' },
            { code: 'IA', name: 'Iowa' },
            { code: 'KS', name: 'Kansas' },
            { code: 'KY', name: 'Kentucky' },
            { code: 'LA', name: 'Louisiana' },
            { code: 'ME', name: 'Maine' },
            { code: 'MD', name: 'Maryland' },
            { code: 'MA', name: 'Massachusetts' },
            { code: 'MI', name: 'Michigan' },
            { code: 'MN', name: 'Minnesota' },
            { code: 'MS', name: 'Mississippi' },
            { code: 'MO', name: 'Missouri' },
            { code: 'MT', name: 'Montana' },
            { code: 'NE', name: 'Nebraska' },
            { code: 'NV', name: 'Nevada' },
            { code: 'NH', name: 'New Hampshire' },
            { code: 'NJ', name: 'New Jersey' },
            { code: 'NM', name: 'New Mexico' },
            { code: 'NY', name: 'New York' },
            { code: 'NC', name: 'North Carolina' },
            { code: 'ND', name: 'North Dakota' },
            { code: 'OH', name: 'Ohio' },
            { code: 'OK', name: 'Oklahoma' },
            { code: 'OR', name: 'Oregon' },
            { code: 'PA', name: 'Pennsylvania' },
            { code: 'RI', name: 'Rhode Island' },
            { code: 'SC', name: 'South Carolina' },
            { code: 'SD', name: 'South Dakota' },
            { code: 'TN', name: 'Tennessee' },
            { code: 'TX', name: 'Texas' },
            { code: 'UT', name: 'Utah' },
            { code: 'VT', name: 'Vermont' },
            { code: 'VA', name: 'Virginia' },
            { code: 'WA', name: 'Washington' },
            { code: 'WV', name: 'West Virginia' },
            { code: 'WI', name: 'Wisconsin' },
            { code: 'WY', name: 'Wyoming' }
        ];
        res.json({ states });
    }
    catch (error) {
        console.error('Get states error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=dropdown.js.map