// orion-platform-service/src/services/privacy/__tests__/PIISanitizer.test.ts
import { PIISanitizer } from '../PIISanitizer';

describe('PIISanitizer', () => {
  let sanitizer: PIISanitizer;

  beforeEach(() => {
    sanitizer = new PIISanitizer();
  });

  describe('detectPII', () => {
    it('should detect email addresses', () => {
      const text = 'Contact us at support@example.com';
      const detected = sanitizer.detectPII(text);
      expect(detected.some(d => d.type === 'email')).toBe(true);
    });

    it('should detect phone numbers', () => {
      const text = 'Phone: +86 138-1234-5678';
      const detected = sanitizer.detectPII(text);
      expect(detected.some(d => d.type === 'phone')).toBe(true);
    });

    it('should detect ID card numbers', () => {
      const text = '身份证号: 110101199001011234';
      const detected = sanitizer.detectPII(text);
      expect(detected.some(d => d.type === 'id_card')).toBe(true);
    });

    it('should detect addresses', () => {
      const text = '地址: 北京市朝阳区建国路100号';
      const detected = sanitizer.detectPII(text);
      expect(detected.some(d => d.type === 'address')).toBe(true);
    });
  });

  describe('detectPIIWithNER', () => {
    it('should detect Chinese names via NER', async () => {
      const text = '用户张三提交了申请';
      const detected = await sanitizer.detectPIIWithNER(text);
      expect(detected.some(d => d.type === 'name')).toBe(true);
    });

    it('should combine regex and NER results', async () => {
      const text = '姓名: 李四, 邮箱: lisi@test.com';
      const detected = await sanitizer.detectPIIWithNER(text);
      expect(detected.some(d => d.type === 'name')).toBe(true);
      expect(detected.some(d => d.type === 'email')).toBe(true);
    });
  });

  describe('sanitize', () => {
    it('should replace PII with placeholders', async () => {
      const text = 'Email: john@example.com, Phone: 13812345678';
      const result = await sanitizer.sanitize(text);
      expect(result.sanitized).toContain('[EMAIL_REDACTED]');
      expect(result.sanitized).toContain('[PHONE_REDACTED]');
    });

    it('should preserve non-PII content', async () => {
      const text = 'This is normal text without PII';
      const result = await sanitizer.sanitize(text);
      expect(result.sanitized).toBe(text);
      expect(result.detectedCount).toBe(0);
    });

    it('should replace ID card numbers', async () => {
      const text = '身份证: 110101199001011234';
      const result = await sanitizer.sanitize(text);
      expect(result.sanitized).toContain('[ID_CARD_REDACTED]');
    });
  });

  describe('accuracy', () => {
    it('should achieve >90% accuracy', async () => {
      // Test with sample dataset
      const testCases = [
        { text: '张三的邮箱是zhangsan@test.com', expectedPII: 2 },
        { text: '联系方式：13812345678，地址北京市朝阳区', expectedPII: 2 },
        { text: '身份证110101199001011234姓名李四', expectedPII: 2 },
      ];

      let correctCount = 0;
      for (const { text, expectedPII } of testCases) {
        const result = await sanitizer.sanitize(text);
        if (result.detectedCount >= expectedPII) correctCount++;
      }

      const accuracy = correctCount / testCases.length;
      expect(accuracy).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('detection details', () => {
    it('should return correct position information', () => {
      const text = 'Email: test@example.com here';
      const detected = sanitizer.detectPII(text);
      const email = detected.find(d => d.type === 'email');
      expect(email).toBeDefined();
      expect(email!.start).toBeGreaterThan(0);
      expect(email!.end).toBeGreaterThan(email!.start);
      expect(text.substring(email!.start, email!.end)).toBe('test@example.com');
    });

    it('should return confidence scores', () => {
      const text = 'test@example.com';
      const detected = sanitizer.detectPII(text);
      expect(detected[0].confidence).toBeGreaterThan(0);
      expect(detected[0].confidence).toBeLessThanOrEqual(1);
    });

    it('should identify detection source (regex or ner)', async () => {
      const text = 'test@example.com';
      const detected = await sanitizer.detectPIIWithNER(text);
      expect(detected[0].source).toBe('regex');
    });
  });
});