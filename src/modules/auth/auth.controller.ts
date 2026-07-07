import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { renderVerifyPage } from '../../../public/html/verify-page.html';
import { Public } from '../../common/decorators/public.decorator';
import { Serialize } from '../../common/decorators/serialize.decorator';
import { GetUser } from '../../common/decorators/user.decorator';
import { LocalAuthGuard } from '../../common/guards/local.guard';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { ForgotPasswordDTO } from './dtos/forgot-password.dto';
import { MagicLinkDTO } from './dtos/magic-link.dto';
import { RegisterDTO } from './dtos/register.dto';
import { ResendDTO } from './dtos/resend.dto';
import { ResetPasswordDTO } from './dtos/reset-password.dto';
import { AuthResponseDTO } from './dtos/response/auth-response.dto';
import { VerifyOTPDTO } from './dtos/verify-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDTO) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Serialize(AuthResponseDTO)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@GetUser() user: User) {
    return this.authService.login(user);
  }

  @Public()
  @Post('refresh')
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(
    @GetUser('id') userID: number,
    @Body('refresh_token') refreshToken?: string,
  ) {
    return this.authService.logout(userID, refreshToken);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('resend')
  resend(@Body() dto: ResendDTO) {
    return this.authService.resend(dto.email);
  }

  @Public()
  @Get('verify')
  async verify(
    @Query('token') verificationToken: string,
    @Headers('accept') accept: string,
    @Res() res: Response,
  ) {
    const acceptJSON = accept?.includes('application/json') ?? false;
    let message: string;
    let status: number = HttpStatus.OK;

    try {
      const result = await this.authService.verify(verificationToken);
      message = result.message ?? 'This account has been verified';

      if (acceptJSON) {
        res.status(HttpStatus.OK).json({
          status_code: HttpStatus.OK,
          message,
          data: null,
        });
        return;
      }
    } catch (err) {
      if (acceptJSON) throw err;
      status =
        err instanceof HttpException
          ? err.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
      message =
        err instanceof HttpException
          ? err.message
          : 'There was an error verifying your account';
    }

    res.status(status).type('text/html').send(renderVerifyPage(message));
  }

  @Public()
  @Serialize(AuthResponseDTO)
  @HttpCode(HttpStatus.OK)
  @Post('magic-link')
  magicLink(@Body() dto: MagicLinkDTO) {
    return this.authService.magicLink(dto.verificationToken);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDTO) {
    return this.authService.requestReset(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-otp')
  verifyOTP(@Body() dto: VerifyOTPDTO) {
    return this.authService.verifyOTP(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDTO) {
    return this.authService.resetPassword(dto);
  }
}
