/**
 * @file 공통 유틸 — email.js
 *
 * @description
 * 날짜·응답·포맷 등 프로젝트 공통 유틸리티입니다.
 *
 * @module utils/email
 */
import nodemailer from 'nodemailer';

/**
 * 이메일 발송 함수
 * @param {string} to - 수신자 이메일 주소
 * @param {string} verificationCode - 인증번호
 * @returns {Promise<boolean>} - 발송 성공 여부
 */
async function sendVerificationEmail(to, verificationCode) {
  try {
    // 환경 변수에서 SMTP 설정 가져오기
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    // SMTP 설정이 없으면 콘솔에 출력 (로컬 개발용)
    if (!smtpUser || !smtpPassword) {
      console.log(`\n========================================`);
      console.log(`[이메일 발송 시뮬레이션]`);
      console.log(`수신자: ${to}`);
      console.log(`인증번호: ${verificationCode}`);
      console.log(`========================================\n`);
      console.log('💡 실제 이메일을 발송하려면 .env.local 파일에 다음 환경 변수를 설정하세요:');
      console.log('   SMTP_HOST=smtp.gmail.com');
      console.log('   SMTP_PORT=587');
      console.log('   SMTP_USER=your-email@gmail.com');
      console.log('   SMTP_PASSWORD=your-app-password');
      console.log('   SMTP_FROM=your-email@gmail.com\n');
      return true; // 개발 모드에서는 성공으로 처리
    }

    // Nodemailer transporter 생성
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // 465 포트는 SSL 사용
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      // Gmail의 경우 추가 설정
      ...(smtpHost.includes('gmail.com') && {
        service: 'gmail',
      }),
    });

    // 이메일 내용
    const mailOptions = {
      from: smtpFrom,
      to: to,
      subject: '[CareProgram_DEMO] 비밀번호 찾기 인증번호',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb; margin-bottom: 20px;">비밀번호 찾기 인증번호</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            안녕하세요,<br><br>
            비밀번호 찾기를 요청하셨습니다.<br>
            아래 인증번호를 입력하여 비밀번호를 재설정해주세요.
          </p>
          <div style="background-color: #f3f4f6; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <p style="font-size: 14px; color: #666; margin: 0 0 10px 0;">인증번호</p>
            <p style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px; margin: 0;">
              ${verificationCode}
            </p>
          </div>
          <p style="font-size: 14px; color: #666; line-height: 1.6;">
            ⚠️ 인증번호는 10분간 유효합니다.<br>
            본인이 요청하지 않았다면 이 이메일을 무시하셔도 됩니다.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} CareProgram_DEMO. All rights reserved.
          </p>
        </div>
      `,
      text: `
        비밀번호 찾기 인증번호
        
        안녕하세요,
        비밀번호 찾기를 요청하셨습니다.
        아래 인증번호를 입력하여 비밀번호를 재설정해주세요.
        
        인증번호: ${verificationCode}
        
        ⚠️ 인증번호는 10분간 유효합니다.
        본인이 요청하지 않았다면 이 이메일을 무시하셔도 됩니다.
        
        © ${new Date().getFullYear()} CareProgram_DEMO. All rights reserved.
      `,
    };

    // 이메일 발송
    const info = await transporter.sendMail(mailOptions);
    console.log('이메일 발송 성공:', info.messageId);
    return true;
  } catch (error) {
    console.error('이메일 발송 오류:', error);
    return false;
  }
}

export { sendVerificationEmail };

