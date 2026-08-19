import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

const providers = [];

// Only enable GoogleProvider if actual Google Client ID is configured
if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here' &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret_here'
) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

// CredentialsProvider allows login via Email/Password or Demo Login
providers.push(
  CredentialsProvider({
    id: 'credentials',
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const email = credentials?.email?.trim() || 'rswathipriya3@gmail.com';
      // Format a clean display name from email (e.g. reachinbox -> ReachInbox)
      const namePart = email.split('@')[0] || 'ReachInbox';
      const name = namePart
        .split(/[._-]/)
        .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');

      return {
        id: 'user-1',
        name: name || 'ReachInbox',
        email: email,
        image:
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=faces',
      };
    },
  }),
);

const handler = NextAuth({
  providers,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as typeof session.user & { id: string }).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  secret:
    process.env.NEXTAUTH_SECRET ||
    'reachinbox_default_secret_32_chars_minimum_length_for_jwt',
});

export { handler as GET, handler as POST };
