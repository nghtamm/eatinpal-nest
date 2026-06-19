export interface IJwtPayload {
  sub: number;
  email: string;
}

export interface IVerificationTokenPayload extends IJwtPayload {
  purpose: 'verification';
}
