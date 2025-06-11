import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NecordModule } from 'necord';
import { IntentsBitField } from 'discord.js';
import { DISCORD_BOT_TOKEN } from './common/constant';
import { AppCommands } from './app.commands';
import { AppUpdate } from './app.update';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        path.resolve(process.cwd(), `.${process.env['NODE_ENV']}.env`),
      ],
      isGlobal: true,
    }),
    NecordModule.forRoot({
      token: process.env[DISCORD_BOT_TOKEN]!,
      intents: [IntentsBitField.Flags.Guilds],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, AppUpdate, AppCommands],
})
export class AppModule {}
