export function infraStatus(env=process.env){
  return {
    databaseUrlConfigured:Boolean(env.DATABASE_URL),
    redisUrlConfigured:Boolean(env.REDIS_URL||env.REDIS_TLS_URL),
    githubTokenConfigured:Boolean(env.GITHUB_TOKEN||env.GH_TOKEN)
  };
}
