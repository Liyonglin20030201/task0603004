import apiClient from './client';

export const getNotificationPreferences = () =>
  apiClient.get('/notification-preferences').then((r: any) => r.data);

export const updateNotificationPreferences = (preferences: Array<{ type: string; channel: string; enabled: boolean }>) =>
  apiClient.put('/notification-preferences', { preferences }).then((r: any) => r.data);

export const getPhone = () =>
  apiClient.get('/notification-preferences/phone').then((r: any) => r.data);

export const updatePhone = (phone: string) =>
  apiClient.put('/notification-preferences/phone', { phone }).then((r: any) => r.data);

export const sendTestEmail = () =>
  apiClient.post('/notification-preferences/test-email').then((r: any) => r.data);

export const sendTestSms = () =>
  apiClient.post('/notification-preferences/test-sms').then((r: any) => r.data);
