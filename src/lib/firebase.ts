// src/lib/firebase.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// IMPORTANT: Ensure you have the necessary Firebase Admin SDK setup
// and environment variables configured.
// 1. Create a service account in your Firebase project settings.
// 2. Download the service account key JSON file.
// 3. Set the GOOGLE_APPLICATION_CREDENTIALS environment variable to the path of this file.
//    Alternatively, load the credentials directly (less secure for source control):
//    import serviceAccount from './path/to/your-service-account-file.json';
//    const credential = cert(serviceAccount);

// Check if Firebase Admin SDK is already initialized
if (!getApps().length) {
  // If GOOGLE_APPLICATION_CREDENTIALS env var is set, it initializes automatically
  initializeApp();
  // Or initialize with specific credentials:
  // initializeApp({
  //   credential: credential // Use cert(serviceAccount) if loading directly
  // });
  console.log('Firebase Admin SDK Initialized.');
} else {
  console.log('Firebase Admin SDK already initialized.');
}


const db = getFirestore();

export { db };
