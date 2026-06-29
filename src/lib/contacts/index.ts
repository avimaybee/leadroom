import { Db } from '@/db';
import { LoggingService } from '@/services/logging';
import { contacts, researchSnapshots } from '@/db/schema/research';
import { activities } from '@/db/schema/core';
import { eq, and, isNull, or, inArray } from 'drizzle-orm';
import type { ContactExtract } from './extract';
import type { AIContactExtractionOutput } from '../ai';

/**
 * Save extracted contacts from website scraping to the contacts table.
 * Deduplicates by email and social URL — skips if a contact with the same
 * email already exists (preserving human-added data over enrichment).
 */
export async function saveExtractedContacts(
  db: Db,
  leadId: string,
  extracted: ContactExtract,
  userId?: string | null
): Promise<number> {
  let saved = 0;

  // Build entries from extracted data
  const entries: Array<{
    fullName?: string | null;
    roleTitle?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedinUrl?: string | null;
    otherProfileUrl?: string | null;
  }> = [];

  // 1. One entry per unique email
  for (const email of extracted.emails) {
    entries.push({
      email,
      phone: null,
      linkedinUrl: null,
      otherProfileUrl: null,
      fullName: null,
      roleTitle: null,
    });
  }

  // 2. Social links that don't already have an email entry
  //    Use LinkedIn as linkedinUrl, others as otherProfileUrl
  if (extracted.socialLinks.linkedin && !extracted.emails.length) {
    entries.push({
      email: null,
      phone: null,
      linkedinUrl: extracted.socialLinks.linkedin,
      otherProfileUrl: null,
      fullName: null,
      roleTitle: null,
    });
  }
  if (extracted.socialLinks.facebook || extracted.socialLinks.instagram ||
      extracted.socialLinks.twitter || extracted.socialLinks.youtube ||
      extracted.socialLinks.tiktok) {
    const otherSocials = [
      extracted.socialLinks.facebook,
      extracted.socialLinks.instagram,
      extracted.socialLinks.twitter,
      extracted.socialLinks.youtube,
      extracted.socialLinks.tiktok,
    ].filter(Boolean) as string[];

    if (otherSocials.length > 0) {
      entries.push({
        email: null,
        phone: null,
        linkedinUrl: null,
        otherProfileUrl: otherSocials[0],
        fullName: null,
        roleTitle: null,
      });
    }
  }

  if (entries.length === 0) return 0;

  // Fetch existing contacts for this lead to avoid duplicates
  const existingContacts = await db.select()
    .from(contacts)
    .where(and(
      eq(contacts.leadId, leadId),
      isNull(contacts.deletedAt)
    ));

  const existingEmails = new Set(
    existingContacts.map(c => c.email?.toLowerCase()).filter(Boolean)
  );
  const existingUrls = new Set(
    existingContacts.map(c => [
      c.linkedinUrl?.toLowerCase(),
      c.otherProfileUrl?.toLowerCase(),
    ]).flat().filter(Boolean)
  );

  const now = new Date();

  for (const entry of entries) {
    // Skip if this email already exists
    if (entry.email && existingEmails.has(entry.email.toLowerCase())) continue;

    // Skip if this URL already exists
    const urlsToCheck = [entry.linkedinUrl, entry.otherProfileUrl].filter(Boolean);
    if (urlsToCheck.length > 0 && urlsToCheck.some(u => existingUrls.has(u!.toLowerCase()))) continue;

    await db.insert(contacts).values({
      id: crypto.randomUUID(),
      leadId,
      fullName: null,
      roleTitle: null,
      email: entry.email || null,
      phone: entry.phone || null,
      linkedinUrl: entry.linkedinUrl || null,
      otherProfileUrl: entry.otherProfileUrl || null,
      isPrimary: 0,
      confidenceLevel: 'MEDIUM',
      sourceType: 'ENRICHMENT',
      createdByUserId: userId || null,
      createdAt: now,
      updatedAt: now,
    });

    saved++;
  }

  return saved;
}

/**
 * Log a system activity for contact discovery results.
 */
export async function logContactDiscoveryActivity(
  db: Db,
  leadId: string,
  extracted: ContactExtract,
  saved: number
): Promise<void> {
  const parts: string[] = [];
  if (extracted.emails.length > 0) parts.push(`${extracted.emails.length} email${extracted.emails.length > 1 ? 's' : ''}`);
  if (extracted.phones.length > 0) parts.push(`${extracted.phones.length} phone${extracted.phones.length > 1 ? 's' : ''}`);
  const socialCount = Object.keys(extracted.socialLinks).length;
  if (socialCount > 0) parts.push(`${socialCount} social profile${socialCount > 1 ? 's' : ''}`);

  if (parts.length === 0) return;

  await new LoggingService(db).log({
    leadId,
    type: 'Contact info discovered',
    summary: `Found ${parts.join(', ')} on website${saved > 0 ? ` (${saved} new contact${saved > 1 ? 's' : ''} saved)` : ''}`,
  });
}

/**
 * Save structured contacts extracted by the AI to the database.
 * Deduplicates against existing email/social URLs to preserve human-added details.
 */
export async function saveAIExtractedContacts(
  db: Db,
  leadId: string,
  extracted: AIContactExtractionOutput | null | undefined,
  userId?: string | null
): Promise<number> {
  if (!extracted) return 0;
  let saved = 0;

  // Fetch existing contacts for this lead to avoid duplicates
  const existingContacts = await db.select()
    .from(contacts)
    .where(and(
      eq(contacts.leadId, leadId),
      isNull(contacts.deletedAt)
    ));

  const existingEmails = new Set(
    existingContacts.map(c => c.email?.toLowerCase()).filter(Boolean)
  );
  const existingUrls = new Set(
    existingContacts.map(c => [
      c.linkedinUrl?.toLowerCase(),
      c.otherProfileUrl?.toLowerCase(),
    ]).flat().filter(Boolean)
  );

  const now = new Date();

  // 1. Save people details
  if (extracted.people && Array.isArray(extracted.people)) {
    for (const person of extracted.people) {
      if (!person) continue;
      // Skip if email exists
      if (person.email && existingEmails.has(person.email.toLowerCase())) continue;
      // Skip if linkedin exists
      if (person.linkedinUrl && existingUrls.has(person.linkedinUrl.toLowerCase())) continue;

      await db.insert(contacts).values({
        id: crypto.randomUUID(),
        leadId,
        fullName: person.fullName || null,
        roleTitle: person.roleTitle || null,
        email: person.email || null,
        phone: person.phone || null,
        linkedinUrl: person.linkedinUrl || null,
        otherProfileUrl: null,
        isPrimary: 0,
        confidenceLevel: 'HIGH', // AI extracted specific person
        sourceType: 'ENRICHMENT',
        createdByUserId: userId || null,
        createdAt: now,
        updatedAt: now,
      });
      saved++;
      
      if (person.email) existingEmails.add(person.email.toLowerCase());
      if (person.linkedinUrl) existingUrls.add(person.linkedinUrl.toLowerCase());
    }
  }

  // 2. Save emails
  if (extracted.emails && Array.isArray(extracted.emails)) {
    for (const email of extracted.emails) {
      if (!email) continue;
      if (existingEmails.has(email.toLowerCase())) continue;

      await db.insert(contacts).values({
        id: crypto.randomUUID(),
        leadId,
        fullName: null,
        roleTitle: null,
        email: email,
        phone: null,
        linkedinUrl: null,
        otherProfileUrl: null,
        isPrimary: 0,
        confidenceLevel: 'MEDIUM',
        sourceType: 'ENRICHMENT',
        createdByUserId: userId || null,
        createdAt: now,
        updatedAt: now,
      });
      saved++;
      existingEmails.add(email.toLowerCase());
    }
  }

  // 3. Save phones
  if (extracted.phones && Array.isArray(extracted.phones)) {
    for (const phone of extracted.phones) {
      if (!phone) continue;
      const hasPhone = existingContacts.some(c => c.phone === phone);
      if (hasPhone) continue;

      await db.insert(contacts).values({
        id: crypto.randomUUID(),
        leadId,
        fullName: null,
        roleTitle: null,
        email: null,
        phone: phone,
        linkedinUrl: null,
        otherProfileUrl: null,
        isPrimary: 0,
        confidenceLevel: 'MEDIUM',
        sourceType: 'ENRICHMENT',
        createdByUserId: userId || null,
        createdAt: now,
        updatedAt: now,
      });
      saved++;
    }
  }

  // 4. Save social links
  if (extracted.socialLinks) {
    const { linkedin, facebook, instagram, twitter, youtube, tiktok } = extracted.socialLinks;
    if (linkedin && !existingUrls.has(linkedin.toLowerCase())) {
      await db.insert(contacts).values({
        id: crypto.randomUUID(),
        leadId,
        fullName: null,
        roleTitle: null,
        email: null,
        phone: null,
        linkedinUrl: linkedin,
        otherProfileUrl: null,
        isPrimary: 0,
        confidenceLevel: 'MEDIUM',
        sourceType: 'ENRICHMENT',
        createdByUserId: userId || null,
        createdAt: now,
        updatedAt: now,
      });
      saved++;
      existingUrls.add(linkedin.toLowerCase());
    }

    const otherSocials = [facebook, instagram, twitter, youtube, tiktok].filter(Boolean) as string[];
    for (const social of otherSocials) {
      if (existingUrls.has(social.toLowerCase())) continue;
      await db.insert(contacts).values({
        id: crypto.randomUUID(),
        leadId,
        fullName: null,
        roleTitle: null,
        email: null,
        phone: null,
        linkedinUrl: null,
        otherProfileUrl: social,
        isPrimary: 0,
        confidenceLevel: 'MEDIUM',
        sourceType: 'ENRICHMENT',
        createdByUserId: userId || null,
        createdAt: now,
        updatedAt: now,
      });
      saved++;
      existingUrls.add(social.toLowerCase());
    }
  }

  return saved;
}
