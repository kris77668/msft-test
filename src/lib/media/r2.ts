import "server-only";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 — where uploaded images live.
 *
 * R2 is object storage with zero egress fees, so end users can pull images
 * directly from its public custom domain (cached by Cloudflare) without
 * touching Supabase's or Netlify's metered bandwidth. It is S3-compatible, so
 * the AWS SDK talks to it with a custom endpoint.
 *
 * Config is read lazily and returns null when unset, so the site runs fine
 * before R2 is provisioned — only the upload action is unavailable, and it says
 * so rather than crashing. The five vars belong in Netlify's env, never the
 * repo: the secret access key can write to the bucket.
 */

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

let cached: S3Client | undefined;

function client(config: R2Config): S3Client {
  cached ??= new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return cached;
}

/**
 * Uploads bytes and returns the public URL.
 *
 * `key` is caller-generated and unique (a uuid), so two uploads of the same
 * photograph never collide and an upload cannot overwrite an existing image.
 * Cache-Control is set to immutable because the URL is content-addressed by its
 * key — a re-upload gets a new key rather than replacing an object in place.
 */
export async function putImage(
  config: R2Config,
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<string> {
  await client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return `${config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
}
