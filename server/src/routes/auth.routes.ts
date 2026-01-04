import express from 'express';
import { z } from 'zod';
import { User } from '../models/User.model.js';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: User already exists
 *       400:
 *         description: Validation error
 */
// Register (with strict rate limiting to prevent brute force)
// SECURITY: Added input validation with Zod schema
router.post('/register', strictRateLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('User already exists with this email', 409);
    }

    // Create new user
    const user = await User.create({
      email,
      password,
      name,
      plan: 'Free'
    });

    const token = generateToken(user._id.toString(), user.email, user.plan, user.role);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          plan: user.plan,
          role: user.role,
          privacyMode: user.privacyMode ?? false // Include privacy mode in register response
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       400:
 *         description: Validation error
 */
// Login (with strict rate limiting to prevent brute force)
// SECURITY: Added input validation with Zod schema
router.post('/login', strictRateLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = generateToken(user._id.toString(), user.email, user.plan, user.role);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          plan: user.plan,
          role: user.role,
          privacyMode: user.privacyMode ?? false // Include privacy mode in login response
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
// SECURITY FIX: Now requires JWT authentication instead of header-based user ID
router.get('/me', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          plan: user.plan,
          role: user.role,
          privacyMode: user.privacyMode ?? false // Include privacy mode
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get privacy settings
// SECURITY FIX: Now requires JWT authentication instead of header-based user ID
router.get('/privacy-settings', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: {
        privacyMode: user.privacyMode ?? false // Default to false if not set
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update privacy settings
// SECURITY FIX: Now requires JWT authentication instead of header-based user ID
router.put('/privacy-settings', authenticateToken, validate(z.object({ privacyMode: z.boolean() })), async (req: AuthRequest, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    const { privacyMode } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { privacyMode },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: {
        privacyMode: user.privacyMode
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;

