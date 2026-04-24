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
import type { Response } from 'express';
import { renderVerifyPage } from '../../../public/html/verify-page.html';
import { Public } from '../../common/decorators/public.decorator';
import { Serialize } from '../../common/decorators/serialize.decorator';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { GetUser } from './decorators/user.decorator';
import { RegisterDTO } from './dto/register.dto';
import { AuthResponseDTO } from './dto/response/auth-response.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { LocalAuthGuard } from './guards/local.guard';

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
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  refresh(
    @GetUser('id') userID: number,
    @Body('refresh_token') refreshToken: string,
  ) {
    return this.authService.refresh(userID, refreshToken);
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
  @Post('resend-verification')
  resendVerification(@Body('email') email: string) {
    return this.authService.resendVerification(email);
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

    try {
      const result = await this.authService.verify(verificationToken);
      message = result.message;

      if (acceptJSON) {
        res.status(HttpStatus.OK).json({
          status_code: HttpStatus.OK,
          message,
          data: { verified: result.verified },
        });
        return;
      }
    } catch (err) {
      if (acceptJSON) throw err;
      message =
        err instanceof HttpException
          ? err.message
          : 'Something went wrong verifying your email';
    }

    res.status(HttpStatus.OK).type('text/html').send(renderVerifyPage(message));
  }

  @Public()
  @Serialize(AuthResponseDTO)
  @HttpCode(HttpStatus.OK)
  @Post('verified-login')
  verifiedLogin(@Body('verification_token') verificationToken: string) {
    return this.authService.verifiedLogin(verificationToken);
  }
}
