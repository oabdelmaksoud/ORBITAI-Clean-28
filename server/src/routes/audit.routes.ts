import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { AuditLog } from '../models/AuditLog.model.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/audit
 * Get audit logs with pagination and filters
 */
router.get('/', async (req: AdminRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const action = req.query.action as string;
    const entityType = req.query.entityType as string;
    const userId = req.query.userId as string;
    const status = req.query.status as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const query: any = {};

    if (action) query.action = { $regex: action, $options: 'i' };
    if (entityType) query.entityType = entityType;
    if (userId) query.userId = userId;
    if (status) query.status = status;

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        logs: logs.map(log => ({
          id: log._id.toString(),
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          userId: log.userId,
          userEmail: log.userEmail,
          details: log.details,
          ipAddress: log.ipAddress,
          status: log.status,
          errorMessage: log.errorMessage,
          createdAt: log.createdAt
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/audit/:id
 * Get audit log details
 */
router.get('/:id', async (req: AdminRequest, res, next) => {
  try {
    const log = await AuditLog.findById(req.params.id).lean();

    if (!log) {
      throw new AppError('Audit log not found', 404);
    }

    res.json({
      success: true,
      data: {
        log: {
          id: log._id.toString(),
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          userId: log.userId,
          userEmail: log.userEmail,
          details: log.details,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          location: log.location,
          context: log.context,
          status: log.status,
          errorMessage: log.errorMessage,
          complianceTags: log.complianceTags,
          createdAt: log.createdAt
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/audit/export/compliance
 * Export audit logs for compliance reporting
 */
router.get('/export/compliance', async (req: AdminRequest, res, next) => {
  try {
    const format = req.query.format as string || 'json';
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const complianceTag = req.query.complianceTag as string;

    const query: any = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (complianceTag) {
      query.complianceTags = complianceTag;
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .lean();

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=compliance-audit-log.csv');
      
      const csv = [
        ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'User', 'IP Address', 'Location', 'Status', 'Compliance Tags'].join(','),
        ...logs.map(log => [
          new Date(log.createdAt).toISOString(),
          log.action,
          log.entityType,
          log.entityId || '',
          log.userEmail || '',
          log.ipAddress || '',
          log.location ? `${log.location.city || ''}, ${log.location.country || ''}` : '',
          log.status,
          (log.complianceTags || []).join(';')
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: {
          logs: logs.map(log => ({
            id: log._id.toString(),
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            userId: log.userId,
            userEmail: log.userEmail,
            details: log.details,
            ipAddress: log.ipAddress,
            location: log.location,
            context: log.context,
            status: log.status,
            complianceTags: log.complianceTags,
            createdAt: log.createdAt
          })),
          total: logs.length,
          exportedAt: new Date().toISOString()
        }
      });
    }
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/audit/gdpr/user/:userId
 * Get all audit logs for a specific user (GDPR data export)
 */
router.get('/gdpr/user/:userId', async (req: AdminRequest, res, next) => {
  try {
    const logs = await AuditLog.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        userId: req.params.userId,
        logs: logs.map(log => ({
          id: log._id.toString(),
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          details: log.details,
          timestamp: log.createdAt
        })),
        total: logs.length,
        exportedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/audit/stats/summary
 * Get audit log statistics
 */
router.get('/stats/summary', async (_req: AdminRequest, res, next) => {
  try {
    const [total, byAction, byEntityType, byStatus, recentActivity] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      AuditLog.aggregate([
        { $group: { _id: '$entityType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      AuditLog.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      AuditLog.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('action entityType userEmail createdAt status')
        .lean()
    ]);

    // Activity by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activityByDay = await AuditLog.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          total,
          byAction: byAction.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>),
          byEntityType: byEntityType.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>),
          byStatus: byStatus.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {} as Record<string, number>)
        },
        recentActivity: recentActivity.map(log => ({
          id: log._id.toString(),
          action: log.action,
          entityType: log.entityType,
          userEmail: log.userEmail,
          createdAt: log.createdAt,
          status: log.status
        })),
        activityByDay: activityByDay.map(item => ({
          date: item._id,
          count: item.count
        }))
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/audit/user/:userId
 * Get audit logs for a specific user
 */
router.get('/user/:userId', async (req: AdminRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const query: any = { userId: req.params.userId };
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        logs: logs.map(log => ({
          id: log._id.toString(),
          ...log
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;

