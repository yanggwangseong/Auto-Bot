import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';
import { Client, TextChannel } from 'discord.js';
import { ZonedDateTime, ZoneId } from '@js-joda/core';
import '@js-joda/timezone';

describe('AppService', () => {
  let appService: AppService;
  let client: Client;
  let configService: ConfigService;

  const mockTextChannel = {
    isTextBased: () => true,
    send: jest.fn(),
    messages: {
      fetch: jest.fn(),
    },
    threads: {
      fetchActive: jest.fn(),
    },
  } as unknown as TextChannel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                DISCORD_MIMO_CHANNEL_ID: 'mimo-channel-id',
                DISCORD_CORE_TIME_CHANNEL_ID: 'core-time-channel-id',
                DISCORD_ATTENDANCE_CHECK_CHANNEL_ID: 'attendance-channel-id',
                DISCORD_PARTICIPANTS: 'user1:User One,user2:User Two',
              };
              return config[key];
            }),
          },
        },
        {
          provide: Client,
          useValue: {
            channels: {
              cache: {
                get: jest.fn(),
              },
            },
          },
        },
      ],
    }).compile();

    appService = module.get<AppService>(AppService);
    client = module.get<Client>(Client);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(appService).toBeDefined();
  });

  describe('createMimoThread', () => {
    it('should create a mimo thread with correct title', async () => {
      (client.channels.cache.get as jest.Mock).mockReturnValue(mockTextChannel);
      const mockMessage = {
        startThread: jest.fn().mockResolvedValue(undefined),
      };
      mockTextChannel.send = jest.fn().mockResolvedValue(mockMessage);

      await appService.createMimoThread();

      const today = ZonedDateTime.now(ZoneId.of('Asia/Seoul'))
        .toLocalDate()
        .toString();
      expect(mockTextChannel.send).toHaveBeenCalledWith(`${today} 미모인증`);
      expect(mockMessage.startThread).toHaveBeenCalledWith({
        name: `${today} 미모인증`,
        autoArchiveDuration: 60,
      });
    });

    it('should handle channel not found error', async () => {
      (client.channels.cache.get as jest.Mock).mockReturnValue(null);
      mockTextChannel.send = jest.fn();

      await appService.createMimoThread();
      expect(mockTextChannel.send).not.toHaveBeenCalled();
    });
  });

  describe('createCoreTimeThread', () => {
    it('should create a core time thread with correct title', async () => {
      (client.channels.cache.get as jest.Mock).mockReturnValue(mockTextChannel);
      const mockMessage = {
        startThread: jest.fn().mockResolvedValue(undefined),
      };
      mockTextChannel.send = jest.fn().mockResolvedValue(mockMessage);

      await appService.createCoreTimeThread();

      const today = ZonedDateTime.now(ZoneId.of('Asia/Seoul'))
        .toLocalDate()
        .toString();
      expect(mockTextChannel.send).toHaveBeenCalledWith(`${today} 코어타임`);
      expect(mockMessage.startThread).toHaveBeenCalledWith({
        name: `${today} 코어타임`,
        autoArchiveDuration: 60,
      });
    });
  });

  /**
   * 1. 참여자 목록/닉네임 매핑
   */
  describe('getUserMap', () => {
    it('should return user map correctly', () => {
      (configService.get as jest.Mock).mockReturnValue(
        '1111:양광성,2222:주현수',
      );
      const userMap = appService.getUserMap();
      expect(userMap).toEqual({
        '1111': '양광성',
        '2222': '주현수',
      });
    });
  });
});
