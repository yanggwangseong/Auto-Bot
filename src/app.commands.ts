import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, TextChannel } from 'discord.js';
import { Context, SlashCommand, SlashCommandContext } from 'necord';
import { DISCORD_MIMO_CHANNEL_ID } from './common/constant';

@Injectable()
export class AppCommands {
  constructor(
    private readonly client: Client,
    private readonly configService: ConfigService,
  ) {}

  @SlashCommand({
    name: 'testthread',
    description: '미모인증 테스트 스레드 생성',
  })
  public async onTestThread(@Context() [interaction]: SlashCommandContext) {
    const channelId = this.configService.get(DISCORD_MIMO_CHANNEL_ID);
    const channel = this.client.channels.cache.get(channelId) as TextChannel;
    if (!channel) {
      return interaction.reply({
        content: '채널을 찾을 수 없습니다.',
        ephemeral: true,
      });
    }

    // 메시지 전송
    const message = await channel.send('미모인증 테스트 스레드입니다!');
    // 스레드 생성
    await message.startThread({
      name: '미모인증 테스트',
      autoArchiveDuration: 60, // 1시간 후 자동 아카이브 (필요시 변경)
    });

    return interaction.reply({
      content: '스레드가 생성되었습니다!',
      ephemeral: true,
    });
  }
}
