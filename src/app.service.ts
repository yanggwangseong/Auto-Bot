import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, TextChannel, ThreadChannel } from 'discord.js';
import {
  DISCORD_ATTENDANCE_CHECK_CHANNEL_ID,
  DISCORD_CORE_TIME_CHANNEL_ID,
  DISCORD_MIMO_CHANNEL_ID,
  DISCORD_PARTICIPANTS,
} from './common/constant';
import { ZonedDateTime, ZoneId } from '@js-joda/core';
import '@js-joda/timezone';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly client: Client,
  ) {}

  async createMimoThread() {
    const channelId = this.configService.get(DISCORD_MIMO_CHANNEL_ID);
    const channel = this.client.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      const kstZone = ZoneId.of('Asia/Seoul');
      const todayKST = ZonedDateTime.now(kstZone).toLocalDate().toString();
      const threadTitle = `${todayKST} 미모인증`;
      const message = await (channel as any).send(threadTitle);
      await message.startThread({
        name: threadTitle,
        autoArchiveDuration: 60,
      });
      this.logger.log(`${threadTitle} 스레드 생성 완료`);
    } else {
      this.logger.error('채널을 찾을 수 없거나 텍스트 채널이 아닙니다.');
    }
  }

  async createCoreTimeThread() {
    const channelId = this.configService.get(DISCORD_CORE_TIME_CHANNEL_ID);
    const channel = this.client.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      const kstZone = ZoneId.of('Asia/Seoul');
      const todayKST = ZonedDateTime.now(kstZone).toLocalDate().toString();
      const threadTitle = `${todayKST} 코어타임`;
      const message = await (channel as any).send(threadTitle);
      await message.startThread({
        name: threadTitle,
        autoArchiveDuration: 60,
      });
      this.logger.log(`${threadTitle} 스레드 생성 완료`);
    } else {
      this.logger.error('채널을 찾을 수 없거나 텍스트 채널이 아닙니다.');
    }
  }

  async attendanceCheck() {
    // 1. 참여자 목록/닉네임 매핑
    const PARTICIPANTS = this.configService.get<string>(DISCORD_PARTICIPANTS)!;
    const userIds = PARTICIPANTS.split(',').map((p) => p.trim());

    // 2. 오늘 날짜 스레드 찾기
    const mimoThread = await this.findTodayThread(
      this.configService.get(DISCORD_MIMO_CHANNEL_ID)!,
      '미모인증',
    );
    const coreThread = await this.findTodayThread(
      this.configService.get(DISCORD_CORE_TIME_CHANNEL_ID)!,
      '코어타임',
    );

    // 3. 각 스레드에서 멤버별 첫 메시지 시간 수집
    const mimoTimes = mimoThread
      ? await this.getFirstMessageTimes(mimoThread)
      : {};
    const coreTimes = coreThread
      ? await this.getFirstMessageTimes(coreThread)
      : {};

    // 4. 출석/지각/결석 판정
    const result = this.judgeAttendance(userIds, mimoTimes, coreTimes);

    // 5. 결과 메시지 생성
    const kstZone = ZoneId.of('Asia/Seoul');
    const todayKST = ZonedDateTime.now(kstZone).toLocalDate().toString();
    let msg = `${todayKST} 출석체크 결과\n`;
    for (const p of userIds) {
      const { late, absent } = result[p] || { late: 0, absent: 1 };
      msg += `${p} : 지각:${late}, 결석:${absent}\n`;
    }

    // 6. 출석체크 채널에 메시지 전송
    const channelId = this.configService.get(
      DISCORD_ATTENDANCE_CHECK_CHANNEL_ID,
    );
    const channel = this.client.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      await (channel as any).send(msg);
      this.logger.log('출석체크 결과 전송 완료');
    } else {
      this.logger.error(
        '출석체크 채널을 찾을 수 없거나 텍스트 채널이 아닙니다.',
      );
    }
  }

  /**
   * 오늘 날짜(YYYY-MM-DD 미모인증, YYYY-MM-DD 코어타임) 스레드 찾기
   */
  async findTodayThread(
    channelId: string,
    threadType: '미모인증' | '코어타임',
  ) {
    const channel = this.client.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return null;
    const textChannel = channel as TextChannel;
    const kstZone = ZoneId.of('Asia/Seoul');
    const todayKST = ZonedDateTime.now(kstZone).toLocalDate().toString();
    const threadTitle = `${todayKST} ${threadType}`;
    // 활성 스레드 목록에서만 찾기
    const activeThreads = await textChannel.threads.fetchActive();
    return (
      activeThreads.threads.find((thread) => thread.name === threadTitle) ||
      null
    );
  }

  /**
   * 스레드 내 멤버별 첫 메시지 작성 시간 수집
   */
  async getFirstMessageTimes(thread: ThreadChannel) {
    const messages = await thread.messages.fetch({ limit: 100 });
    const firstTimes: Record<string, Date> = {};
    messages.forEach((msg) => {
      if (
        !firstTimes[msg.author.id] ||
        msg.createdAt < firstTimes[msg.author.id]
      ) {
        firstTimes[msg.author.id] = msg.createdAt;
      }
    });
    return firstTimes;
  }

  /**
   * 출석/지각/결석 판정
   */
  judgeAttendance(
    participants: string[], // userId 배열
    mimoTimes: Record<string, Date>,
    coreTimes: Record<string, Date>,
  ) {
    const result: Record<string, { late: number; absent: number }> = {};
    const kst = (date: Date) => {
      // UTC → KST 변환
      const utc = date.getTime() + date.getTimezoneOffset() * 60000;
      return new Date(utc + 9 * 60 * 60 * 1000);
    };

    for (const userId of participants) {
      let late = 0;
      let absent = 0;

      const mimo = mimoTimes[userId];
      const core = coreTimes[userId];

      // 미모인증 판정
      if (mimo) {
        const t = kst(mimo);
        if (t.getHours() > 8 || (t.getHours() === 8 && t.getMinutes() > 0)) {
          late += 1;
        }
      }

      // 코어타임 판정
      if (core) {
        const t = kst(core);
        if (t.getHours() < 13 || t.getHours() >= 17) {
          late += 1;
        }
      }

      // 둘 다 없으면 결석
      if (!mimo && !core) {
        absent = 1;
        late = 0;
      }

      result[userId] = { late, absent };
    }
    return result;
  }
}
