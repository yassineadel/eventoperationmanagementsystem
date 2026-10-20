export const chatStrings = {
  en: {
    open: 'Ask Hafletna', launcherHint: 'Your event guide', title: 'Hafletna guide', subtitle: 'Good plans start here.',
    close: 'Minimise chat', clear: 'Start a new conversation', reset: 'Conversation cleared.',
    sample: 'Sample assistant', languageNote: 'English replies', eyebrow: 'A little guidance',
    welcome: 'Your next plan starts here.', intro: 'Explore events, find your way through booking, or ask about your next step.',
    prompts: ['How do I buy tickets?', 'How do transfers work?', 'What is the refund policy?', 'Find a free event'],
    you: 'You', assistant: 'Hafletna', conversation: 'Conversation', typing: 'Hafletna is typing',
    input: 'Your question', placeholder: 'Ask a question in English…', send: 'Send message',
    hint: 'Enter to send · Shift + Enter for a new line', count: 'characters',
    privacy: 'Public sample guidance only. No access to your account. Chat clears on refresh.',
    retry: 'Try again', unavailable: 'That reply could not be loaded. Try again or ask another question.',
    timeout: 'The reply took too long. Try again or ask another question.',
  },
  ar: {
    open: 'اسأل حفلتنا', launcherHint: 'دليلك للفعاليات', title: 'دليل حفلتنا', subtitle: 'خطتك القادمة تبدأ هنا.',
    close: 'تصغير المحادثة', clear: 'بدء محادثة جديدة', reset: 'تم مسح المحادثة.',
    sample: 'مساعد تجريبي', languageNote: 'الردود بالإنجليزية', eyebrow: 'نساعدك في الاختيار',
    welcome: 'لنخطط لتجربتك القادمة.', intro: 'اكتشف الفعاليات وتعرّف على خطوات الحجز، أو اسأل عن خطوتك التالية.',
    prompts: ['كيف أشتري التذاكر؟', 'كيف يعمل نقل التذكرة؟', 'ما سياسة الاسترداد؟', 'ابحث عن فعالية مجانية'],
    you: 'أنت', assistant: 'حفلتنا', conversation: 'المحادثة', typing: 'حفلتنا يكتب الآن',
    input: 'سؤالك', placeholder: 'اكتب سؤالك بالإنجليزية…', send: 'إرسال الرسالة',
    hint: 'Enter للإرسال · Shift + Enter لسطر جديد', count: 'حرف',
    privacy: 'إرشادات عامة تجريبية فقط، دون الوصول إلى حسابك. تُمسح المحادثة عند تحديث الصفحة.',
    retry: 'حاول مرة أخرى', unavailable: 'تعذّر تحميل الرد. حاول مرة أخرى أو اطرح سؤالاً آخر.',
    timeout: 'استغرق الرد وقتاً طويلاً. حاول مرة أخرى أو اطرح سؤالاً آخر.',
  },
} as const

export const promptQueries = ['How do I buy tickets?', 'How do transfers work?', 'What is the refund policy?', 'Find a free event'] as const
