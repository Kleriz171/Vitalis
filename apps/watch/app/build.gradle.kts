plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "dev.vitalis.watch"
    compileSdk = 35

    defaultConfig {
        // Same id as the phone app, so Wear OS treats them as one product.
        applicationId = "dev.vitalis.app"
        minSdk = 30 // Wear OS 3
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
        // Where the API lives. Debug builds talk to the Mac running the API (10.0.2.2 from the emulator).
        buildConfigField("String", "API_URL", "\"${project.findProperty("apiUrl") ?: "http://10.0.2.2:4000/api"}\"")
    }
    buildTypes {
        debug { manifestPlaceholders["cleartext"] = "true" }
        release {
            manifestPlaceholders["cleartext"] = "false"
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.wear.compose:compose-material:1.4.0")
    implementation("androidx.wear.compose:compose-foundation:1.4.0")
    implementation("androidx.health:health-services-client:1.1.0-alpha05")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-guava:1.9.0")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    testImplementation("junit:junit:4.13.2")
}
