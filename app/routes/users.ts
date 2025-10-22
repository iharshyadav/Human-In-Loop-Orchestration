import express from 'express';
import prisma from '../database/db';

const router = express.Router();

// GET /api/users - Get all users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
        permissions: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      count: users.length,
      users
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/users/:userId - Get specific user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        createdWorkflows: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true
          }
        },
        assignedTasks: {
          select: {
            id: true,
            stepId: true,
            status: true,
            createdAt: true,
            workflow: {
              select: {
                name: true
              }
            }
          }
        },
        approvedTasks: {
          select: {
            id: true,
            stepId: true,
            status: true,
            response: true,
            updatedAt: true,
            workflow: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  try {
    const {
      email,
      username,
      firstName,
      lastName,
      role,
      department,
      permissions
    } = req.body;

    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, firstName, lastName, role'
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(username ? [{ username }] : [])
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    const user = await prisma.user.create({
      data: {
        email,
        username,
        firstName,
        lastName,
        role,
        department,
        permissions: permissions || []
      }
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/users/:userId - Update user
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      email,
      username,
      firstName,
      lastName,
      role,
      department,
      permissions,
      isActive
    } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(email && { email }),
        ...(username && { username }),
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(role && { role }),
        ...(department !== undefined && { department }),
        ...(permissions && { permissions }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/users/role/:role - Get users by role
router.get('/role/:role', async (req, res) => {
  try {
    const { role } = req.params;

    const users = await prisma.user.findMany({
      where: {
        role,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        department: true,
        permissions: true
      }
    });

    res.json({
      success: true,
      role,
      count: users.length,
      users
    });

  } catch (error) {
    console.error('Error fetching users by role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users by role',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;