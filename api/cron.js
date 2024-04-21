export const config = {
  runtime: "edge", // this is a pre-requisite
};
import { createClient } from "@vercel/kv";
import jsSHA from "jssha/dist/sha3";

const SessionNum = parseInt(process.env.CONCURRENT_TOKENS || "16", 10);

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const cores = [8, 12, 16, 24];
const screens = [3000, 4000, 6000];
function getConfig() {
  const core = cores[Math.floor(Math.random() * cores.length)];
  const screen = screens[Math.floor(Math.random() * screens.length)];
  return [core + screen, "" + new Date(), 4294705152, 0, userAgent];
}
async function generateAnswer(seed, difficulty) {
  let hash = null;
  let config = getConfig();
  for (let attempt = 0; attempt < 100000; attempt++) {
    config[3] = attempt;
    const configBase64 = Buffer.from(JSON.stringify(config)).toString("base64");
    const hashInput = seed + configBase64;
    const shaObj = new jsSHA("SHA3-512", "TEXT", { encoding: "UTF8" });
    shaObj.update(hashInput);
    const hash = shaObj.getHash("HEX");
    if (hash.substring(0, difficulty.length) <= difficulty) {
      return "gAAAAAB" + configBase64;
    }
  }
  hash = Buffer.from(`"${seed}"`).toString("base64");
  return "gAAAAABwQ8Lk5FbGpA2NcR9dShT6gYjU7VxZ4D" + hash;
}

async function getSession(reqUrl) {
  let redis;
  // 如果使用了Upstash, 就
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    redis = createClient({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } else {
    redis = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }

  const sessionsArr = [];
  const promises = [];
  let errorCount = 0;


  for (let i = 0; i < SessionNum; i++) {
    const promise = new Promise(async (resolve, reject) => {
      setTimeout(async () => {
        try {
          const requestUrl = process.env.PUBLIC_URL || reqUrl.origin;
          const response = await fetch(`${requestUrl}/api/requirements`);
          if(response.status == 401) {
            console.log('请设置环境变量PUBLIC_URL为你的网站地址');
            resolve(null);
          }
          const myResponse = await response.json();
          // console.log(`系统: 成功获取会话 ID 和令牌。`);
          const token = myResponse.token;
          const newDeviceId = myResponse.deviceid;
          const proofofwork = myResponse.proofofwork;
          const { seed, difficulty } = proofofwork;

          const proof = await generateAnswer(seed, difficulty);
          resolve({ oaiDeviceId: newDeviceId, token, proof });
        } catch (error) {
          // console.error("发起请求时出错:", error.message);
          errorCount++;
          resolve(null);
        }
      }, i * 300);
    });
    promises.push(promise);
  }

  try {
    const results = await Promise.all(promises);
    results.forEach((result) => {
      if (result !== null) {
        sessionsArr.push(result);
      }
    });

    if (errorCount === SessionNum) {
      return "获取会话 ID 和令牌失败";
    }

    await redis.hset("session:pro", {
      refresh: 0,
      sessionArr: sessionsArr,
    });
    return `成功存储${sessionsArr.length}个令牌到数据库。`;
  } catch (error) {
    return "存储时出错:" + error.message;
  }
}

export function GET(request, context) {
  let reqUrl = new URL(request.url);
  // context.waitUntil(getSession(reqUrl).then((json) => console.log({ json })));

  return new Response(`暂不需要定时任务!`);
}
