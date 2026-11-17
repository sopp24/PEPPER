import test from "node:test";
import assert from "node:assert/strict";
import { parseSituations, isValidBearer } from "../netlify/functions/transport-status.mjs";

const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<Siri xmlns="http://www.siri.org.uk/siri">
  <ServiceDelivery>
    <SituationExchangeDelivery>
      <Situations>
        <PtSituationElement>
          <SituationNumber>SNCF-ALERT-001</SituationNumber>
          <Severity>severe</Severity>
          <Summary><Text xml:lang="fr">Train retardé</Text></Summary>
          <Description><Text xml:lang="fr">Un incident affecte ce train.</Text></Description>
          <Affects>
            <VehicleJourneys>
              <AffectedVehicleJourney>
                <VehiculeJourneyRef>8511</VehiculeJourneyRef>
              </AffectedVehicleJourney>
            </VehicleJourneys>
          </Affects>
          <CreationTime>2026-11-17T08:00:00Z</CreationTime>
        </PtSituationElement>
        <PtSituationElement>
          <SituationNumber>SNCF-ALERT-002</SituationNumber>
          <Severity>minor</Severity>
          <Summary><Text>Autre train</Text></Summary>
          <Affects>
            <VehicleJourneys>
              <AffectedVehicleJourney>
                <VehicleJourneyRef>85112</VehicleJourneyRef>
              </AffectedVehicleJourney>
            </VehicleJourneys>
          </Affects>
        </PtSituationElement>
      </Situations>
    </SituationExchangeDelivery>
  </ServiceDelivery>
</Siri>`;

test("parseSituations returns the alert matching the exact commercial train number", () => {
  const alerts = parseSituations(fixture, "8511");
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].id, "SNCF-ALERT-001");
  assert.equal(alerts[0].title, "Train retardé");
  assert.equal(alerts[0].description, "Un incident affecte ce train.");
  assert.equal(alerts[0].severity, "severe");
});

test("parseSituations does not interpret absence of a match as punctuality", () => {
  const alerts = parseSituations(fixture, "7777");
  assert.deepEqual(alerts, []);
});

test("isValidBearer accepts the matching private token", () => {
  const request = new Request("https://pepper.example/.netlify/functions/transport-status", {
    headers: { authorization: "Bearer abc123-private-token" }
  });
  assert.equal(isValidBearer(request, "abc123-private-token"), true);
});

test("isValidBearer rejects a missing or incorrect private token", () => {
  const missing = new Request("https://pepper.example/.netlify/functions/transport-status");
  const wrong = new Request("https://pepper.example/.netlify/functions/transport-status", {
    headers: { authorization: "Bearer wrong-token" }
  });
  assert.equal(isValidBearer(missing, "abc123-private-token"), false);
  assert.equal(isValidBearer(wrong, "abc123-private-token"), false);
});
