import axios from "axios";
import https from "https";
import { randomUUID } from "crypto";

const baseUrl = "https://chat.openai.com";

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "oai-language": "en-US",
    origin: baseUrl,
    pragma: "no-cache",
    referer: baseUrl,
    "sec-ch-ua":
      '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  },
});

export default async function handler(request, response) {
  const newDeviceId = request.headers["oai-device-id"] || randomUUID();

  try {
    const myResponse = await axiosInstance.post(
      `${baseUrl}/backend-anon/sentinel/chat-requirements`,
      {},
      {
        headers: { "oai-device-id": newDeviceId },
      }
    );
    const responseData = {
      ...myResponse.data,
      deviceid: newDeviceId,
    };

    console.log(`成功获取会话 ID 和令牌。`);
    return response.json(responseData);
  } catch (error) {
    console.log("获取会话ID出错:", error.message);
    return response
      .status(500)
      .json({ error: `获取会话ID出错: ${error.name}` });
  }
}
