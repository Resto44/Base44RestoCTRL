/**
 * Supabase Helper Library
 * Provides reusable authentication, database, and session management utilities
 */

import { supabase } from '@/api/supabaseClient';

// Authentication Helpers
export const authHelpers = {
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { success: true, user: data.user, session: data.session };
    } catch (error) {
      console.error('[authHelpers.signIn]', error.message);
      return { success: false, error };
    }
  },

  async signUp(email, password, metadata = {}) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      if (error) throw error;
      return { success: true, user: data.user };
    } catch (error) {
      console.error('[authHelpers.signUp]', error.message);
      return { success: false, error };
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('[authHelpers.signOut]', error.message);
      return { success: false, error };
    }
  },

  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { session, error: null };
    } catch (error) {
      console.error('[authHelpers.getSession]', error.message);
      return { session: null, error };
    }
  },

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { user, error: null };
    } catch (error) {
      console.error('[authHelpers.getCurrentUser]', error.message);
      return { user: null, error };
    }
  },
};

// Database Helpers
export const dbHelpers = {
  async getById(table, id) {
    try {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error(`[dbHelpers.getById:${table}]`, error.message);
      return { data: null, error };
    }
  },

  async insert(table, record) {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from(table)
        .insert({
          ...record,
          created_date: record.created_date || now,
          updated_date: record.updated_date || now,
        })
        .select()
        .single();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error(`[dbHelpers.insert:${table}]`, error.message);
      return { data: null, error };
    }
  },

  async update(table, id, updates) {
    try {
      const { data, error } = await supabase
        .from(table)
        .update({ ...updates, updated_date: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error(`[dbHelpers.update:${table}]`, error.message);
      return { data: null, error };
    }
  },

  async delete(table, id) {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return { success: true, error: null };
    } catch (error) {
      console.error(`[dbHelpers.delete:${table}]`, error.message);
      return { success: false, error };
    }
  },
};

// Session Management Helpers
export const sessionHelpers = {
  async getUserProfile() {
    try {
      const { user, error: userError } = await authHelpers.getCurrentUser();
      if (userError || !user) throw userError || new Error('Not authenticated');

      const { data: profile, error: profileError } = await dbHelpers.getById('profiles', user.id);
      if (profileError) throw profileError;

      return {
        user,
        profile: profile || { id: user.id, email: user.email },
        error: null,
      };
    } catch (error) {
      console.error('[sessionHelpers.getUserProfile]', error.message);
      return { user: null, profile: null, error };
    }
  },

  async updateUserProfile(updates) {
    try {
      const { user, error: userError } = await authHelpers.getCurrentUser();
      if (userError || !user) throw userError || new Error('Not authenticated');

      const { data, error } = await dbHelpers.update('profiles', user.id, updates);
      if (error) throw error;

      return { profile: data, error: null };
    } catch (error) {
      console.error('[sessionHelpers.updateUserProfile]', error.message);
      return { profile: null, error };
    }
  },

  async hasRole(role) {
    try {
      const { profile, error } = await sessionHelpers.getUserProfile();
      if (error) throw error;
      return profile?.role === role;
    } catch (error) {
      console.error('[sessionHelpers.hasRole]', error.message);
      return false;
    }
  },
};

// Real-time Subscription Helpers
export const realtimeHelpers = {
  subscribe(table, onData) {
    try {
      const channel = supabase
        .channel(`realtime:${table}:${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            onData({
              type: payload.eventType.toLowerCase(),
              record: payload.new || payload.old,
              oldRecord: payload.old,
            });
          }
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    } catch (error) {
      console.error(`[realtimeHelpers.subscribe:${table}]`, error.message);
      return () => {};
    }
  },
};

export default {
  authHelpers,
  dbHelpers,
  sessionHelpers,
  realtimeHelpers,
};
