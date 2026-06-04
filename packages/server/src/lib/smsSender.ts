import Dysmsapi20170525, { SendSmsRequest } from '@alicloud/dysmsapi20170525';
import { Config } from '@alicloud/openapi-client';

let client: Dysmsapi20170525 | null = null;

function getClient(): Dysmsapi20170525 | null {
  if (client) return client;

  const accessKeyId = process.env.SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.SMS_ACCESS_KEY_SECRET;

  if (!accessKeyId || !accessKeySecret) {
    return null;
  }

  const config = new Config({ accessKeyId, accessKeySecret });
  config.endpoint = 'dysmsapi.aliyuncs.com';
  client = new Dysmsapi20170525(config);
  return client;
}

export async function sendSms(phone: string, content: string): Promise<boolean> {
  const c = getClient();
  if (!c) {
    console.log('[SMS] Aliyun SMS not configured, skipping');
    return false;
  }

  const signName = process.env.SMS_SIGN_NAME;
  const templateCode = process.env.SMS_TEMPLATE_CODE;

  if (!signName || !templateCode) {
    console.log('[SMS] SMS_SIGN_NAME or SMS_TEMPLATE_CODE not set');
    return false;
  }

  try {
    const request = new SendSmsRequest({
      phoneNumbers: phone,
      signName,
      templateCode,
      templateParam: JSON.stringify({ content: content.substring(0, 70) }),
    });

    const response = await c.sendSms(request);
    if (response.body?.code === 'OK') {
      return true;
    }
    console.error('[SMS] Send failed:', response.body?.message);
    return false;
  } catch (err) {
    console.error('[SMS] Send error:', err);
    return false;
  }
}
