plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "labs.odkaz.zuerst"
    compileSdk = 36

    defaultConfig {
        applicationId = "labs.odkaz.zuerst"
        minSdk = 26
        targetSdk = 35
        versionCode = 8
        versionName = "1.4.0"
        if (!providers.gradleProperty("zuerstAllAbis").isPresent) {
            ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
        }
    }

    buildFeatures { compose = true }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    sourceSets.getByName("main").assets.srcDir(rootProject.file("../shared"))
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.tracing:tracing:1.2.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("com.google.mlkit:text-recognition:16.0.1")
    implementation("com.google.android.gms:play-services-mlkit-image-labeling:16.0.8")
    implementation("androidx.health.connect:connect-client:1.1.0")
    implementation("dev.chrisbanes.haze:haze:1.1.1")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}

tasks.withType<Test>().configureEach {
    systemProperty("zuerst.catalog", rootProject.file("../shared/catalog.json").absolutePath)
    systemProperty("zuerst.domainFixtures", rootProject.file("../shared/domain-fixtures.json").absolutePath)
}
