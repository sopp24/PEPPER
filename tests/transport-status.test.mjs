import test from "node:test";
import assert from "node:assert/strict";
import { parseSituations } from "../netlify/functions/transport-status.mjs";

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
