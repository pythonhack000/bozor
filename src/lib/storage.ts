import { supabase } from "./supabase";

export async function uploadListingPhotos(files: File[], userId: string): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("listing-photos").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

// Private bucket — returns the storage path (not a public URL). The path is
// prefixed with the user's own id, which storage RLS requires for read/write.
export async function uploadKycDocument(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("kyc-documents").upload(path, file);
  if (error) throw error;
  return path;
}

export async function getKycDocumentSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

// Private bucket, same own-folder pattern as kyc-documents — buyers attach a
// real payment screenshot instead of pasting a link the admin has to trust.
export async function uploadDepositProof(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("deposit-proofs").upload(path, file);
  if (error) throw error;
  return path;
}

export async function getDepositProofSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("deposit-proofs").createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}
