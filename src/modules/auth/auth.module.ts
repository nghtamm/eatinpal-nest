import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthCron } from './auth.cron';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserAuthProvider } from './entities/user-auth-provider.entity';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { SignupService } from './services/signup.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserAuthProvider, RefreshToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('cfg.jwt.SECRET'),
        signOptions: {
          expiresIn: configService.get('cfg.jwt.EXPIRATION'),
        },
      }),
    }),
    UsersModule,
    PassportModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    TokenService,
    SignupService,
    PasswordService,
    LocalStrategy,
    JwtStrategy,
    AuthCron,
  ],
})
export class AuthModule {}
