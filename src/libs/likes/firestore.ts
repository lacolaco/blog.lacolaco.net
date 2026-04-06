import { Firestore } from '@google-cloud/firestore';

let db: Firestore | null = null;

export function getFirestore(): Firestore {
  if (!db) {
    db = new Firestore({
      projectId: process.env.GCP_PROJECT_ID || 'blog-lacolaco-net',
    });
  }
  return db;
}
