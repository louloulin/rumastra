/**
 * 通知工具
 * 
 * 此工具提供发送各种类型通知的功能，包括电子邮件、短信、应用内通知和webhook。
 * 这是一个模拟实现，实际项目中应替换为真实的通知发送逻辑。
 */

module.exports = async function notification(input) {
  // 验证必要参数
  if (!input || !input.type) {
    throw new Error('缺少必要参数：type');
  }
  
  if (!input.recipient) {
    throw new Error('缺少必要参数：recipient');
  }
  
  if (!input.content || !input.content.subject || !input.content.body) {
    throw new Error('缺少必要参数：content（需包含subject和body）');
  }
  
  // 验证通知类型
  const validTypes = ['email', 'sms', 'in-app', 'webhook'];
  if (!validTypes.includes(input.type)) {
    throw new Error(`不支持的通知类型: ${input.type}。支持的类型: ${validTypes.join(', ')}`);
  }
  
  // 设置默认值
  const priority = input.priority || 'normal';
  const scheduling = input.scheduling || { 
    sendAt: new Date().toISOString(),
    repeat: 'none'
  };
  
  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 根据不同通知类型返回不同的模拟结果
  let result;
  switch (input.type) {
    case 'email':
      result = simulateEmailSending(input.recipient, input.content, priority, scheduling);
      break;
    case 'sms':
      result = simulateSmsSending(input.recipient, input.content, priority, scheduling);
      break;
    case 'in-app':
      result = simulateInAppNotification(input.recipient, input.content, priority, scheduling);
      break;
    case 'webhook':
      result = simulateWebhookCall(input.recipient, input.content, priority, scheduling);
      break;
  }
  
  return {
    status: 'success',
    message: `已成功安排${getNotificationTypeInChinese(input.type)}通知`,
    notificationType: input.type,
    recipient: maskRecipient(input.recipient, input.type),
    contentPreview: truncateContent(input.content),
    priority: priority,
    scheduling: scheduling,
    timestamp: new Date().toISOString(),
    ...result
  };
};

// 辅助函数：获取通知类型的中文名称
function getNotificationTypeInChinese(type) {
  const typeMap = {
    'email': '电子邮件',
    'sms': '短信',
    'in-app': '应用内',
    'webhook': 'Webhook'
  };
  return typeMap[type] || type;
}

// 辅助函数：模拟电子邮件发送
function simulateEmailSending(recipient, content, priority, scheduling) {
  return {
    deliveryDetails: {
      estimatedDeliveryTime: new Date(Date.now() + 60000).toISOString(),
      emailServer: 'smtp.mastraruntime.example.com',
      messageId: `MSG-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}@mastraruntime.example.com`,
      emailCategory: getEmailCategory(content.subject),
      deliveryAttempts: 1
    }
  };
}

// 辅助函数：模拟短信发送
function simulateSmsSending(recipient, content, priority, scheduling) {
  return {
    deliveryDetails: {
      estimatedDeliveryTime: new Date(Date.now() + 30000).toISOString(),
      smsProvider: 'MastraSMS',
      messageSegments: Math.ceil(content.body.length / 160),
      messageId: `SMS-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    }
  };
}

// 辅助函数：模拟应用内通知
function simulateInAppNotification(recipient, content, priority, scheduling) {
  return {
    deliveryDetails: {
      estimatedDeliveryTime: new Date(Date.now() + 5000).toISOString(),
      notificationId: `NOTIF-${Date.now()}`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      userOnlineStatus: Math.random() > 0.5 ? 'online' : 'offline',
      deviceTargets: ['mobile', 'web']
    }
  };
}

// 辅助函数：模拟Webhook调用
function simulateWebhookCall(recipient, content, priority, scheduling) {
  return {
    deliveryDetails: {
      estimatedDeliveryTime: new Date(Date.now() + 1000).toISOString(),
      webhookUrl: maskWebhookUrl(recipient),
      requestId: `WEBHOOK-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      requestMethod: 'POST',
      contentType: 'application/json'
    }
  };
}

// 辅助函数：根据主题获取邮件类别
function getEmailCategory(subject) {
  const subjectLower = subject.toLowerCase();
  if (subjectLower.includes('报告') || subjectLower.includes('report')) {
    return 'business';
  } else if (subjectLower.includes('警告') || subjectLower.includes('alert') || subjectLower.includes('警报')) {
    return 'alert';
  } else if (subjectLower.includes('通知') || subjectLower.includes('公告')) {
    return 'announcement';
  } else {
    return 'general';
  }
}

// 辅助函数：掩盖接收者信息（出于隐私考虑）
function maskRecipient(recipient, type) {
  if (type === 'email') {
    const [username, domain] = recipient.split('@');
    if (username && domain) {
      const maskedUsername = username.length > 2 
        ? username.substring(0, 2) + '*'.repeat(username.length - 2)
        : username;
      return `${maskedUsername}@${domain}`;
    }
  } else if (type === 'sms') {
    if (recipient.length > 4) {
      return recipient.substring(0, 3) + '*'.repeat(recipient.length - 7) + recipient.substring(recipient.length - 4);
    }
  } else if (type === 'webhook') {
    return maskWebhookUrl(recipient);
  }
  return recipient;
}

// 辅助函数：掩盖webhook URL
function maskWebhookUrl(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}/***`;
  } catch (e) {
    return url;
  }
}

// 辅助函数：截断通知内容（用于预览）
function truncateContent(content) {
  return {
    subject: content.subject,
    body: content.body.length > 50 
      ? content.body.substring(0, 50) + '...' 
      : content.body
  };
} 