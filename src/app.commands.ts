import { Injectable } from '@nestjs/common';
import { Context, SlashCommand, SlashCommandContext } from 'necord';

@Injectable()
export class AppCommands {
  constructor() {}

  // @SlashCommand({
  //   name: '인증하기',
  //   description: '이미지 인증을 진행합니다.',
  // })
  // async onAuthCommand(@Context() [interaction]: SlashCommandContext) {
  //   try {
  //     await interaction.reply({
  //       content: '이미지 파일을 첨부해서 이 메시지에 답장(Reply)해주세요!',
  //       ephemeral: true,
  //     });
  //     const reply = await interaction.fetchReply();
  //     // 인증 메시지 ID를 AppService에 전달
  //     const appService = (interaction.client as any).appService;
  //     if (appService && typeof appService.setAuthMessageId === 'function') {
  //       appService.setAuthMessageId(reply.id);
  //     }
  //   } catch (error) {
  //     console.error('슬래시 커맨드 응답 중 에러 발생:', error);
  //     if (interaction.deferred || interaction.replied) {
  //       await interaction.followUp({
  //         content: '응답 처리 중 오류가 발생했습니다.',
  //         ephemeral: true,
  //       });
  //     }
  //   }
  // }
  @SlashCommand({
    name: 'test-command',
    description: 'test',
  })
  async onTestCommand(@Context() [interaction]: SlashCommandContext) {
    return interaction.reply({ content: 'test' });
  }
}
