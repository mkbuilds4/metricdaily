# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Setting the Audit Log Password

To set a password for accessing the Audit Log page, you need to set an environment variable.

1.  **Create a `.env.local` file:**
    If you don't already have one, create a file named `.env.local` in the root directory of your project.

2.  **Add the password variable:**
    Inside `.env.local`, add the following line, replacing `your_super_secret_password` with your desired password:
    ```
    NEXT_PUBLIC_AUDIT_LOG_PASSWORD=your_super_secret_password
    ```

3.  **Restart your development server:**
    If your Next.js development server is running, you'll need to stop it and restart it for the new environment variable to be picked up.

    ```bash
    npm run dev
    # or
    yarn dev
    ```

**Important Notes:**

*   The `.env.local` file should **not** be committed to your version control system (e.g., Git) as it may contain sensitive information. Make sure `.env.local` is listed in your `.gitignore` file.
*   For production deployments (e.g., on Vercel, Netlify, or other hosting platforms), you will need to set this environment variable through your hosting provider's dashboard or configuration settings. The `NEXT_PUBLIC_` prefix makes it available to the client-side code.
*   If the `NEXT_PUBLIC_AUDIT_LOG_PASSWORD` is not set, the application will default to `'Metrics@24'` as the password for local development (this is defined in `public/next.config.js`). However, it is strongly recommended to set your own password for security.
*   This method of client-side password protection is **not highly secure** and is primarily for basic access control in a trusted environment. For robust security, proper server-side authentication mechanisms should be implemented.
