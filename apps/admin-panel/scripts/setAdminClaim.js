const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'spaceborn-ecomm'
});

async function grantRole(email, role) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    let claims = user.customClaims || {};
    if (role === 'admin') {
      claims.admin = true;
      claims.vendor = false;
    } else if (role === 'vendor') {
      claims.admin = false;
      claims.vendor = true;
    }
    await admin.auth().setCustomUserClaims(user.uid, claims);
    console.log(`Successfully granted ${role} role to ${email}`);
  } catch (error) {
    console.error('Error granting role:', error);
  }
}

const email = process.argv[2];
const role = process.argv[3];
if (!email || !role) {
  console.log("Usage: node setAdminClaim.js <email> <role>");
  process.exit(1);
}
grantRole(email, role);
