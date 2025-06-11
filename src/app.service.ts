import { Injectable } from '@nestjs/common';
import { Context, TextCommand, TextCommandContext } from 'necord';

@Injectable()
export class AppService {
  @TextCommand({
    name: 'ping',
    description: 'Ping command!',
  })
  public onPing(@Context() [message]: TextCommandContext) {
    return message.reply('pong!');
  }
}
