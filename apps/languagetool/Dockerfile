FROM eclipse-temurin:21-jre-jammy

# The official open-source distribution has no cloud/AI-based rules.
ARG LANGUAGETOOL_VERSION=6.6
RUN --mount=type=secret,id=extra-ca,required=false \
    if [ -s /run/secrets/extra-ca ]; then cat /run/secrets/extra-ca >> /etc/ssl/certs/ca-certificates.crt; fi \
 && apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates \
 && if [ -s /run/secrets/extra-ca ]; then cat /run/secrets/extra-ca >> /etc/ssl/certs/ca-certificates.crt; fi \
 && curl -fsSL --retry 3 "https://languagetool.org/download/LanguageTool-${LANGUAGETOOL_VERSION}.zip" -o /tmp/languagetool.zip \
 && unzip -q /tmp/languagetool.zip -d /opt \
 && mv "/opt/LanguageTool-${LANGUAGETOOL_VERSION}" /opt/languagetool \
 && rm /tmp/languagetool.zip \
 && apt-get purge -y --auto-remove unzip \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --no-create-home languagetool

WORKDIR /opt/languagetool
USER languagetool
EXPOSE 8081
# Explicit en-US checks do not need a language-identification ML model.
ENTRYPOINT ["java", "-cp", "languagetool-server.jar", "org.languagetool.server.HTTPServer", "--port", "8081", "--public"]
