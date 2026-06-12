export interface DiscoveryLead {
  name: string;
  website: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  sourceUrl: string | null;
  industry: string | null;
}

export async function searchGoogleMaps(niche: string, location: string, limit: number = 30): Promise<DiscoveryLead[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error('APIFY_API_TOKEN is not configured in environment variables');
  }

  const input = {
    searchStringsArray: [niche],
    locationQuery: location,
    maxCrawledPlacesPerSearch: limit,
    language: "en",
    searchMatching: "all",
    website: "allPlaces",
    skipClosedPlaces: true,
    scrapePlaceDetailPage: false,
    scrapeTableReservationProvider: false,
    scrapeOrderOnline: false,
    includeWebResults: false,
    scrapeDirectories: false,
    maxQuestions: 0,
    scrapeContacts: false,
    scrapeSocialMediaProfiles: {
        facebooks: false,
        instagrams: false,
        youtubes: false,
        tiktoks: false,
        twitters: false
    },
    maximumLeadsEnrichmentRecords: 0,
    verifyLeadsEnrichmentEmails: false,
    maxReviews: 0,
    maxImages: 0,
    scrapeImageAuthors: false,
  };

  console.log(`[Apify] Searching for ${niche} in ${location} via REST API...`);
  
  // 1. Start the actor run
  const runRes = await fetch(`https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/runs?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });

  if (!runRes.ok) {
    const errorText = await runRes.text();
    throw new Error(`Failed to start Apify actor: status ${runRes.status} - ${errorText}`);
  }

  const runData = (await runRes.json()) as {
    data?: {
      id: string;
      defaultDatasetId: string;
      status: string;
    };
  };

  if (!runData.data) {
    throw new Error('Apify API returned an invalid run response');
  }

  const { id: runId, defaultDatasetId: datasetId } = runData.data;

  // 2. Poll status until completed
  let status = runData.data.status;
  const startTime = Date.now();
  const timeoutMs = 240000; // 4 minutes timeout

  while (status === 'RUNNING' || status === 'READY') {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Apify actor run timed out');
    }
    // Wait for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const checkRes = await fetch(`https://api.apify.com/v2/acts/nwua9Gu5YrADL7ZDj/runs/${runId}?token=${token}`);
    if (!checkRes.ok) {
      throw new Error(`Failed to check status of Apify actor: status ${checkRes.status}`);
    }

    const checkData = (await checkRes.json()) as {
      data?: {
        status: string;
      };
    };
    status = checkData.data?.status || 'FAILED';
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify actor run failed with status: ${status}`);
  }

  // 3. Fetch dataset items
  console.log(`[Apify] Run finished. Fetching dataset items from ${datasetId}...`);
  const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`);
  if (!itemsRes.ok) {
    throw new Error(`Failed to fetch Apify dataset items: status ${itemsRes.status}`);
  }

  const items = (await itemsRes.json()) as any[];

  return items.map((item: any) => ({
    name: item.title || item.name || 'Unknown Business',
    website: item.website || null,
    phone: item.phone || item.phoneUnformatted || null,
    city: item.city || location.split(',')[0].trim() || null,
    region: item.state || null,
    sourceUrl: item.url || null,
    industry: item.categoryName || niche,
  }));
}
