import { Injectable, Logger } from '@nestjs/common';
import { Context, On, Once, ContextOf } from 'necord';
import { ConfigService } from '@nestjs/config';
import { DISCORD_MIMO_CHANNEL_ID } from './common/constant';

@Injectable()
export class AppUpdate {
  private readonly logger = new Logger(AppUpdate.name);

  public constructor(private readonly configService: ConfigService) {}

  @Once('ready')
  public async onReady(@Context() [client]: ContextOf<'ready'>) {
    this.logger.log(`Bot logged in as ${client.user.username}`);

    const channelId = this.configService.get(DISCORD_MIMO_CHANNEL_ID);
    const channel = client.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      // 메시지 전송
      const message = await (channel as any).send(
        '미모인증 테스트 스레드입니다!',
      );
      // 스레드 생성
      await message.startThread({
        name: '미모인증 테스트',
        autoArchiveDuration: 60,
      });
      this.logger.log('미모인증 테스트 스레드 생성 완료');
    } else {
      this.logger.error('채널을 찾을 수 없거나 텍스트 채널이 아닙니다.');
    }
  }

  @On('warn')
  public onWarn(@Context() [message]: ContextOf<'warn'>) {
    this.logger.warn(message);
  }
}
