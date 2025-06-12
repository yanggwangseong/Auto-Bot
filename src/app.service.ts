import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'discord.js';
import {
  DISCORD_CORE_TIME_CHANNEL_ID,
  DISCORD_MIMO_CHANNEL_ID,
} from './common/constant';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private authMessageId: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly client: Client,
  ) {}

  async createMimoThread() {
    const channelId = this.configService.get(DISCORD_MIMO_CHANNEL_ID);
    const channel = this.client.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      const message = await (channel as any).send(
        '미모인증 테스트 스레드입니다!',
      );
      await message.startThread({
        name: '미모인증 테스트',
        autoArchiveDuration: 60,
      });
      this.logger.log('미모인증 테스트 스레드 생성 완료');
    } else {
      this.logger.error('채널을 찾을 수 없거나 텍스트 채널이 아닙니다.');
    }
  }

  async createCoreTimeThread() {
    const channelId = this.configService.get(DISCORD_CORE_TIME_CHANNEL_ID);
    const channel = this.client.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      const message = await (channel as any).send(
        '코어타임 테스트 스레드입니다!',
      );
      await message.startThread({
        name: '코어타임 테스트',
        autoArchiveDuration: 60,
      });
      this.logger.log('코어타임 테스트 스레드 생성 완료');
    } else {
      this.logger.error('채널을 찾을 수 없거나 텍스트 채널이 아닙니다.');
    }
  }

  setAuthMessageId(messageId: string) {
    this.authMessageId = messageId;
    this.logger.log(`인증 메시지 ID 저장: ${messageId}`);
  }

  onModuleInit() {
    this.client.on('messageCreate', async (message) => {
      // 인증 메시지에 대한 답장만 처리
      if (
        this.authMessageId &&
        message.reference?.messageId === this.authMessageId &&
        !message.author.bot
      ) {
        if (message.attachments.size === 0) {
          await message.reply('이미지 파일을 첨부해주세요!');
          return;
        }
        const isImage = Array.from(message.attachments.values()).every((att) =>
          att.contentType?.startsWith('image/'),
        );
        if (!isImage) {
          await message.reply('이미지 파일만 업로드 해주세요!');
          return;
        }
        // 이미지 인증 처리
        await message.reply('이미지 인증이 완료되었습니다!');
        this.logger.log('이미지 인증 완료');
      }
    });
  }
}
