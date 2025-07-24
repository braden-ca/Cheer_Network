import express from 'express';
import { supabase } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { createMessageSchema } from '../middleware/validation';
import { EmailService } from '../services/emailService';

const router = express.Router();
const emailService = EmailService.getInstance();

// Send a message
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const senderId = req.user!.id;
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ error: 'Receiver ID and content are required' });
    }

    // Verify receiver exists
    const { data: receiver, error: receiverError } = await supabase
      .from('users')
      .select('user_id, role')
      .eq('user_id', receiverId)
      .single();

    if (receiverError || !receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Check if users are connected (for athlete-clinician communication)
    const senderRole = req.user!.role;
    if (senderRole === 'athlete' && receiver.role === 'clinician') {
      const { data: followRelationship } = await supabase
        .from('follow_relationships')
        .select('status')
        .eq('athlete_id', senderId)
        .eq('clinician_id', receiverId)
        .eq('status', 'accepted')
        .single();

      if (!followRelationship) {
        return res.status(403).json({ error: 'You must be connected to message this clinician' });
      }
    } else if (senderRole === 'clinician' && receiver.role === 'athlete') {
      const { data: followRelationship } = await supabase
        .from('follow_relationships')
        .select('status')
        .eq('athlete_id', receiverId)
        .eq('clinician_id', senderId)
        .eq('status', 'accepted')
        .single();

      if (!followRelationship) {
        return res.status(403).json({ error: 'You must be connected to message this athlete' });
      }
    }

    // Create message
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        content: content.trim()
      })
      .select(`
        message_id,
        content,
        read,
        sent_at,
        sender:users!sender_id(first_name, last_name),
        receiver:users!receiver_id(first_name, last_name)
      `)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation between two users (support both /conversation/:otherUserId and /:otherUserId)
router.get('/conversation/:otherUserId', authenticateToken, async (req, res) => {
  try {
    // Set cache control headers to prevent caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const userId = req.user!.id;
    const { otherUserId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Get messages between the two users
    const { data: messages, error, count } = await supabase
      .from('messages')
      .select(`
        message_id,
        sender_id,
        receiver_id,
        content,
        read,
        sent_at
      `, { count: 'exact' })
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
      .order('sent_at', { ascending: true })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Mark messages as read (where current user is receiver)
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', userId)
      .eq('sender_id', otherUserId)
      .eq('read', false);

    console.log(`Returning ${messages.length} messages for conversation ${userId} <-> ${otherUserId}`);

    res.json({
      messages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all conversations for a user
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    console.log('Getting conversations for user:', { userId, userRole });

    // Get messages where user is sender
    const { data: sentMessages, error: sentError } = await supabase
      .from('messages')
      .select(`
        message_id,
        sender_id,
        receiver_id,
        content,
        sent_at,
        read,
        sender:users!sender_id(user_id, first_name, last_name, profile_image_url),
        receiver:users!receiver_id(user_id, first_name, last_name, profile_image_url)
      `)
      .eq('sender_id', userId)
      .order('sent_at', { ascending: false });

    if (sentError) {
      console.error('Sent messages query error:', sentError);
      return res.status(400).json({ error: sentError.message });
    }

    // Get messages where user is receiver
    const { data: receivedMessages, error: receivedError } = await supabase
      .from('messages')
      .select(`
        message_id,
        sender_id,
        receiver_id,
        content,
        sent_at,
        read,
        sender:users!sender_id(user_id, first_name, last_name, profile_image_url),
        receiver:users!receiver_id(user_id, first_name, last_name, profile_image_url)
      `)
      .eq('receiver_id', userId)
      .order('sent_at', { ascending: false });

    if (receivedError) {
      console.error('Received messages query error:', receivedError);
      return res.status(400).json({ error: receivedError.message });
    }

    // Combine and sort messages
    const messagesData = [...(sentMessages || []), ...(receivedMessages || [])]
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

    console.log('Messages query result:', { 
      messagesCount: messagesData?.length || 0, 
      sampleMessage: messagesData?.[0] 
    });

    // Group by conversation partner
    const conversationMap = new Map();
    messagesData.forEach(message => {
      const partnerId = message.sender_id === userId ? message.receiver_id : message.sender_id;
      const partner = message.sender_id === userId ? message.receiver : message.sender;
      
      console.log('Processing message:', {
        messageId: message.message_id,
        senderId: message.sender_id,
        receiverId: message.receiver_id,
        partnerId,
        partner,
        isCurrentUser: message.sender_id === userId
      });
      
      if (!conversationMap.has(partnerId) && partner) {
        // Handle both array and object formats
        const partnerData = Array.isArray(partner) ? partner[0] : partner;
        conversationMap.set(partnerId, {
          clinician_id: partnerId, // Use clinician_id for frontend compatibility
          partner_id: partnerId,
          partner_name: `${partnerData.first_name || 'Unknown'} ${partnerData.last_name || 'User'}`,
          partner_profile_image: partnerData.profile_image_url,
          last_message: message.content,
          last_message_time: message.sent_at, // Use last_message_time for frontend compatibility
          last_message_at: message.sent_at, // Keep both for compatibility
          unread_count: 0
        });
      }
      
      // Count unread messages where current user is receiver
      if (message.receiver_id === userId && !message.read) {
        conversationMap.get(partnerId).unread_count++;
      }
    });

    const conversationsArray = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());

    console.log('Final conversations array:', conversationsArray);

    res.json({ conversations: conversationsArray });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark messages as read
router.put('/mark-read/:otherUserId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { otherUserId } = req.params;

    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', userId)
      .eq('sender_id', otherUserId)
      .eq('read', false);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation between two users (alternative route for frontend compatibility)
router.get('/:otherUserId', authenticateToken, async (req, res) => {
  try {
    // Set cache control headers to prevent caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    const userId = req.user!.id;
    const { otherUserId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    console.log(`Getting messages for conversation ${userId} <-> ${otherUserId}`);

    // Get messages between the two users
    const { data: messages, error, count } = await supabase
      .from('messages')
      .select(`
        message_id,
        sender_id,
        receiver_id,
        content,
        read,
        sent_at
      `, { count: 'exact' })
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
      .order('sent_at', { ascending: true })
      .range(offset, offset + Number(limit) - 1);

    if (error) {
      console.error('Messages query error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Mark messages as read (where current user is receiver)
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', userId)
      .eq('sender_id', otherUserId)
      .eq('read', false);

    console.log(`Returning ${messages.length} messages for conversation ${userId} <-> ${otherUserId}`);

    res.json({
      messages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread message count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('receiver_id', userId)
      .eq('read', false);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ unreadCount: count || 0 });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a message (only sender can delete)
router.delete('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user!.id;

    // Verify message exists and user is the sender
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('message_id', messageId)
      .single();

    if (messageError || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender_id !== userId) {
      return res.status(403).json({ error: 'Can only delete your own messages' });
    }

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('message_id', messageId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search messages
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { q, limit = 20 } = req.query;

    if (!q || (q as string).length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        message_id,
        sender_id,
        receiver_id,
        content,
        sent_at,
        sender:users!sender_id(first_name, last_name, profile_image_url),
        receiver:users!receiver_id(first_name, last_name, profile_image_url)
      `)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .ilike('content', `%${q}%`)
      .order('sent_at', { ascending: false })
      .limit(Number(limit));

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ messages });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 