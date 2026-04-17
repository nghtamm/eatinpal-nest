export default () => ({
  awsRegion: process.env.AWS_REGION,
  awsAccessKeyID: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sesFromEmail: process.env.SES_FROM_EMAIL,
});
